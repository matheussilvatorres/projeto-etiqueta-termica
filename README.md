# ThermoLabel — Conversor de Etiquetas Térmicas

Converte PDFs de etiquetas da Amazon para o formato exato da sua impressora térmica (AIYIN AE240 ou qualquer outra).

---

## Pré-requisitos

Você precisa ter instalado:

- **Python 3.9 ou superior** → https://www.python.org/downloads/
- **pip** (já vem junto com o Python na maioria dos sistemas)

Para verificar se já tem, abra o terminal/cmd e execute:
```
python --version
pip --version
```

---

## Instalação e execução — Passo a passo

### 1. Baixe ou copie os arquivos do projeto

Crie uma pasta chamada `label-resizer` no seu computador e coloque todos os arquivos dentro dela. A estrutura deve ficar assim:

```
label-resizer/
├── app.py
├── requirements.txt
├── templates/
│   └── index.html
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── uploads/      ← criada automaticamente
└── outputs/      ← criada automaticamente
```

### 2. Abra o terminal dentro da pasta do projeto

**Windows:** Abra o Explorador de Arquivos na pasta `label-resizer`, clique na barra de endereço, digite `cmd` e pressione Enter.

**Mac/Linux:** Abra o Terminal e execute:
```bash
cd caminho/para/label-resizer
```

### 3. (Recomendado) Crie um ambiente virtual

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python3 -m venv venv
source venv/bin/activate
```

Você verá `(venv)` no início da linha do terminal — isso é normal e correto.

### 4. Instale as dependências

```bash
pip install -r requirements.txt
```

Aguarde o download terminar (pode demorar 1-2 minutos na primeira vez).

### 5. Inicie o servidor

```bash
python app.py
```

Você verá algo assim:
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

### 6. Abra no navegador

Acesse: **http://localhost:5000**

O site estará funcionando! 🎉

---

## Como usar

1. **Enviar PDF** — Arraste o PDF de etiquetas da Amazon ou clique para selecionar.

2. **Configurar** — Ajuste as dimensões:
   - **Largura/Altura**: tamanho final de cada etiqueta (padrão: 50×25mm para AIYIN AE240)
   - **Colunas/Linhas**: quantas etiquetas existem por página no PDF original da Amazon
     - PDF padrão da Amazon = 2 colunas × 5 linhas

3. **Converter** — Clique em "Converter Etiquetas" e aguarde.

4. **Baixar** — Clique em "Baixar PDF Convertido". O arquivo terá uma etiqueta por página, no tamanho exato que você configurou.

---

## Configuração para a AIYIN AE240

| Parâmetro       | Valor          |
|----------------|----------------|
| Largura         | 50 mm          |
| Altura          | 25 mm          |
| Colunas (PDF Amazon) | 2         |
| Linhas (PDF Amazon)  | 5         |

Ao imprimir: selecione **"Tamanho personalizado de página"** ou **"Sem margens"** nas configurações de impressão, e defina o tamanho da página como **50×25mm**.

---

## Solução de problemas

**Erro "ModuleNotFoundError"**
→ Verifique se rodou `pip install -r requirements.txt` com o ambiente virtual ativo.

**Etiquetas saindo cortadas ou desalinhadas**
→ Ajuste os valores de **Colunas** e **Linhas** para corresponder ao layout do seu PDF.
→ Dica: abra o PDF original no Adobe Reader e conte quantas etiquetas existem por página.

**Porta 5000 ocupada**
→ Edite a última linha do `app.py` e mude para outra porta:
```python
app.run(debug=True, port=5001)
```
Depois acesse `http://localhost:5001`.

**Para encerrar o servidor:** pressione `Ctrl + C` no terminal.

---

## Parar e reiniciar depois

Na próxima vez que for usar:
```bash
# Ative o ambiente virtual (se criou um)
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Inicie o servidor
python app.py
```

---

## Segurança

- Os arquivos enviados são **deletados automaticamente** após o processamento.
- O servidor roda apenas localmente (não fica exposto na internet).
- Os PDFs gerados ficam na pasta `outputs/` e podem ser removidos manualmente.
