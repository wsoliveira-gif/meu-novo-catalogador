from datetime import datetime, timedelta
import pytz
import requests
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import time
import os # Mantenha este import, pode ser útil para outras coisas ou se você quiser derivar o caminho de __file__ no futuro

# Definição do modelo
Base = declarative_base()

class ResultadoBlaze(Base):
    __tablename__ = 'resultado_blaze'
    id = Column(Integer, primary_key=True)
    numero = Column(Integer, nullable=False)
    cor = Column(String(50), nullable=False) # Agora vai armazenar 'red', 'black', 'white' com sua lógica
    horario_br = Column(DateTime, nullable=False, unique=True)

    def __repr__(self):
        return f"<ResultadoBlaze(numero={self.numero}, cor='{self.cor}', horario_br='{self.horario_br}')>"

# Configuração do banco de dados

# --- INÍCIO DA MODIFICAÇÃO PARA CAMINHO ABSOLUTO ---

# Caminho absoluto DIRETO para o seu banco de dados
# Usando barras normais '/' para melhor compatibilidade.
# Se preferir usar barras invertidas '\' do Windows, use uma raw string: r"C:\Users\Pessoal\Desktop\CATALOGADOR WEB\blaze_results.db"
caminho_absoluto_db = "C:/Users/Pessoal/Desktop/CATALOGADOR WEB/blaze_results.db"

# Imprime o caminho que será usado pela engine
print(f"[COLETOR - USANDO CAMINHO DB ABSOLUTO] sqlite:///{caminho_absoluto_db}")

# Agora a engine usa diretamente o caminho absoluto
engine = create_engine(f'sqlite:///{caminho_absoluto_db}')

# --- FIM DA MODIFICAÇÃO PARA CAMINHO ABSOLUTO ---

Base.metadata.create_all(engine) # Cria a tabela se não existir, usando a engine configurada
Session = sessionmaker(bind=engine)

def get_latest_results():
    url = "https://blaze.bet.br/api/singleplayer-originals/originals/roulette_games/recent/1"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status() # Levanta um erro para códigos HTTP 4xx/5xx
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Erro ao buscar dados da API: {e}")
        return None

def save_results(results_data):
    if not results_data:
        return

    session = Session()
    brazil_tz = pytz.timezone('America/Sao_Paulo')

    for result in results_data:
        game_number = result.get('roll')
        api_color_code = result.get('color') # Não usado diretamente para salvar, mas pode ser útil para log se a lógica mudar
        created_at_utc_str = result.get('created_at')

        if game_number is None or created_at_utc_str is None: # api_color_code não é mais essencial para a lógica de salvamento de cor
            print(f"Dados incompletos recebidos (número ou data): {result}")
            continue

        try:
            # LÓGICA PARA DETERMINAR A COR BASEADA NO game_number (roll)
            if game_number >= 1 and game_number <= 7:
                color = 'red'
            elif game_number >= 8 and game_number <= 14:
                color = 'black'
            elif game_number == 0:
                color = 'white'
            else:
                color = 'unknown' # Caso um número fora do esperado apareça
            
            created_at_utc = datetime.strptime(created_at_utc_str, '%Y-%m-%dT%H:%M:%S.%fZ')
            created_at_utc = pytz.utc.localize(created_at_utc) # Torna o datetime aware do UTC
            horario_br = created_at_utc.astimezone(brazil_tz) # Converte para o fuso de São Paulo

            # Descomente a linha abaixo se quiser ver o horário antes de salvar durante o debug
            # print(f"Horário BR (antes de salvar): {horario_br.strftime('%Y-%m-%d %H:%M:%S.%f%z')}, Número: {game_number}, Cor Calculada: {color}")

            existing_result = session.query(ResultadoBlaze).filter_by(horario_br=horario_br).first()

            if not existing_result:
                new_result = ResultadoBlaze(
                    numero=game_number,
                    cor=color,
                    horario_br=horario_br
                )
                session.add(new_result)
                session.commit()
                print(f"Adicionado: {new_result}")
            else:
                # Descomente se quiser logar quando um resultado duplicado é encontrado e ignorado
                # print(f"Resultado já existente (ignorado): Número {game_number}, Horário {horario_br}")
                pass 
        except Exception as e:
            session.rollback()
            print(f"Erro ao processar/salvar resultado {result}: {e}")
    session.close()

if __name__ == "__main__":
    print("Iniciando coleta de dados do Blaze Double. Pressione CTRL+C para parar.")
    # Adiciona uma pequena espera inicial, caso o DB esteja sendo criado ou algo assim. Opcional.
    # time.sleep(1) 
    while True:
        print(f"\n[{datetime.now(pytz.timezone('America/Sao_Paulo')).strftime('%Y-%m-%d %H:%M:%S %Z')}] Iniciando nova coleta...")
        results_data = get_latest_results()
        if results_data:
            save_results(results_data)
        else:
            print("Nenhum dado coletado ou erro na API. Tentando novamente em 5 segundos.")
        
        # Intervalo entre as coletas
        time.sleep(7)