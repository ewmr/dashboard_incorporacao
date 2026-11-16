# Registros de desvio a enviar ao ClickUp

Suba aqui (Add file → Upload files) o arquivo baixado no painel **A enviar** do Registro de Desvios
e clique em **Commit changes**. A rotina "Enviar registros de desvio ao ClickUp" cria as tarefas no
Registro de Alteração de Prazos em uns 2 minutos e move o arquivo para `registros/enviados/`.

Se algum item falhar, ele continua nesta pasta e é reenviado no próximo upload (ou em Actions →
Enviar registros de desvio ao ClickUp → Run workflow). Um mesmo registro nunca é gravado duas vezes.
