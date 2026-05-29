import os
import uuid
import fitz
from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

MM_TO_PT = 2.8346456693


def detect_grid(page, cols, rows):
    """
    Detecta margens, pitch vertical e bounds horizontais reais do conteúdo
    de cada coluna, para garantir centralização perfeita.
    """
    pw = page.rect.width
    ph = page.rect.height
    cell_w = pw / cols

    # --- Pitch vertical ---
    mat = fitz.Matrix(2, 2)
    pix = page.get_pixmap(matrix=mat, clip=fitz.Rect(0, 0, cell_w, ph))
    samples = pix.samples
    w_d, h_d = pix.width, pix.height

    content_rows = [
        y for y in range(h_d)
        if any(b < 200 for b in samples[y * w_d * 3:(y + 1) * w_d * 3])
    ]

    if not content_rows:
        top_margin_pt = 0
        pitch_pt = ph / rows
    else:
        label_starts = [content_rows[0]]
        for i in range(1, len(content_rows)):
            if content_rows[i] - content_rows[i - 1] > 20:
                label_starts.append(content_rows[i])
        merged = [label_starts[0]]
        for s in label_starts[1:]:
            if s - merged[-1] > h_d / rows * 0.5:
                merged.append(s)
        merged = merged[:rows]
        pitch_pt = (merged[1] - merged[0]) / 2.0 if len(merged) >= 2 else ph / rows
        top_margin_pt = (ph - pitch_pt * rows) / 2

    # --- Bounds horizontais reais por coluna ---
    col_x_bounds = []
    for col in range(cols):
        x0_cell = col * cell_w
        x1_cell = x0_cell + cell_w
        clip = fitz.Rect(x0_cell, top_margin_pt, x1_cell, top_margin_pt + pitch_pt)
        mat2 = fitz.Matrix(3, 3)
        pix2 = page.get_pixmap(matrix=mat2, clip=clip)
        s2 = pix2.samples
        w2, h2 = pix2.width, pix2.height

        content_cols = [
            x for x in range(w2)
            if any(s2[(y * w2 + x) * 3] < 200 for y in range(h2))
        ]

        if content_cols:
            left_pt = content_cols[0] / 3.0
            right_pt = content_cols[-1] / 3.0
            col_x_bounds.append((x0_cell + left_pt, x0_cell + right_pt))
        else:
            col_x_bounds.append((x0_cell, x1_cell))

    return top_margin_pt, pitch_pt, col_x_bounds


def process_labels(input_path, output_path, label_width_mm, label_height_mm, cols, rows):
    MM = MM_TO_PT
    target_w = label_width_mm * MM
    target_h = label_height_mm * MM
    DPI = 300
    scale_render = DPI / 72.0

    doc_in = fitz.open(input_path)
    doc_out = fitz.open()

    top_margin_pt = None
    pitch_pt = None
    col_x_bounds = None

    for page_idx in range(len(doc_in)):
        page = doc_in[page_idx]
        ph = page.rect.height

        # Detecta grid apenas na primeira página
        if top_margin_pt is None:
            top_margin_pt, pitch_pt, col_x_bounds = detect_grid(page, cols, rows)

        for row in range(rows):
            for col in range(cols):
                # Crop horizontal: usa bounds reais do conteúdo (centralizado)
                content_x0, content_x1 = col_x_bounds[col]
                content_w = content_x1 - content_x0

                # Crop vertical: usa pitch detectado
                y0 = top_margin_pt + row * pitch_pt
                y1 = y0 + pitch_pt

                clip = fitz.Rect(content_x0, y0, content_x1, y1)
                mat = fitz.Matrix(scale_render, scale_render)
                pix = page.get_pixmap(matrix=mat, clip=clip, colorspace=fitz.csGRAY)

                new_page = doc_out.new_page(width=target_w, height=target_h)

                # Escala uniforme mantendo proporção
                sx = target_w / pix.width * scale_render
                sy = target_h / pix.height * scale_render
                s = min(sx, sy)

                placed_w = pix.width * s / scale_render
                placed_h = pix.height * s / scale_render

                # Centraliza na página de saída
                ox = (target_w - placed_w) / 2
                oy = (target_h - placed_h) / 2

                new_page.insert_image(
                    fitz.Rect(ox, oy, ox + placed_w, oy + placed_h),
                    pixmap=pix
                )

    doc_out.save(output_path, deflate=True)
    doc_in.close()
    doc_out.close()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/convert", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado."}), 400

    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Apenas arquivos PDF são aceitos."}), 400

    try:
        label_width_mm  = float(request.form.get("width_mm", 50))
        label_height_mm = float(request.form.get("height_mm", 25))
        cols = int(request.form.get("cols", 3))
        rows = int(request.form.get("rows", 9))
    except (ValueError, TypeError):
        return jsonify({"error": "Parâmetros inválidos."}), 400

    if not (10 <= label_width_mm <= 300):
        return jsonify({"error": "Largura deve ser entre 10 e 300mm."}), 400
    if not (10 <= label_height_mm <= 300):
        return jsonify({"error": "Altura deve ser entre 10 e 300mm."}), 400
    if not (1 <= cols <= 10):
        return jsonify({"error": "Colunas deve ser entre 1 e 10."}), 400
    if not (1 <= rows <= 20):
        return jsonify({"error": "Linhas deve ser entre 1 e 20."}), 400

    job_id = str(uuid.uuid4())
    input_path  = os.path.join(UPLOAD_FOLDER, f"{job_id}_input.pdf")
    output_path = os.path.join(OUTPUT_FOLDER, f"{job_id}_output.pdf")

    file.save(input_path)

    try:
        doc_check = fitz.open(input_path)
        num_pages = len(doc_check)
        doc_check.close()

        if num_pages == 0:
            return jsonify({"error": "PDF vazio ou inválido."}), 400

        process_labels(input_path, output_path, label_width_mm, label_height_mm, cols, rows)

        doc_out = fitz.open(output_path)
        out_pages = len(doc_out)
        doc_out.close()

        return jsonify({
            "success": True,
            "job_id": job_id,
            "input_pages": num_pages,
            "output_labels": out_pages,
            "label_size": f"{label_width_mm}x{label_height_mm}mm",
        })

    except Exception as e:
        for p in [input_path, output_path]:
            if os.path.exists(p):
                os.remove(p)
        return jsonify({"error": f"Erro ao processar PDF: {str(e)}"}), 500

    finally:
        if os.path.exists(input_path):
            os.remove(input_path)


@app.route("/download/<job_id>")
def download(job_id):
    if not all(c.isalnum() or c == "-" for c in job_id):
        return jsonify({"error": "ID inválido."}), 400
    output_path = os.path.join(OUTPUT_FOLDER, f"{job_id}_output.pdf")
    if not os.path.exists(output_path):
        return jsonify({"error": "Arquivo não encontrado ou expirado."}), 404
    return send_file(output_path, as_attachment=True,
                     download_name="etiquetas_termicas.pdf",
                     mimetype="application/pdf")


if __name__ == "__main__":
    app.run(debug=True, port=5000)
