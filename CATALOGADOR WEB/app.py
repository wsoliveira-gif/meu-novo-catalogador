from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, time, timedelta
import pytz
from sqlalchemy import create_engine, Column, Integer, String, DateTime # Removido func não utilizado
import os
from collections import Counter

app = Flask(__name__)
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
db_path_absolute = os.path.join(basedir, 'blaze_results.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path_absolute}'
print(f"[APP.PY - CAMINHO DB] SQLAlchemy URI: {app.config['SQLALCHEMY_DATABASE_URI']}")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class ResultadoBlaze(db.Model):
    __tablename__ = 'resultado_blaze'
    id = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.Integer, nullable=False)
    cor = db.Column(db.String(50), nullable=False)
    horario_br = db.Column(db.DateTime, nullable=False, unique=True) 

    def to_dict(self):
        return {
            'blaze_id': self.id,
            'numero': self.numero,
            'cor': self.cor,
            'horario_br': self.horario_br.isoformat()
        }

with app.app_context():
    db.create_all()

def get_date_range(date_str_param, time_filter_hours_param):
    brazil_tz = pytz.timezone('America/Sao_Paulo')
    now_brt = datetime.now(brazil_tz)
    
    query_date_obj = None
    if date_str_param:
        query_date_obj = datetime.strptime(date_str_param, '%Y-%m-%d').date()
    else:
        query_date_obj = now_brt.date()

    is_today = (query_date_obj == now_brt.date())
    
    start_datetime_brt = None
    end_datetime_brt = None

    hours_to_filter = 0
    if time_filter_hours_param:
        try:
            hours_to_filter = int(time_filter_hours_param)
        except ValueError:
            hours_to_filter = 0

    if is_today and hours_to_filter > 0:
        end_datetime_brt = now_brt
        start_datetime_brt = now_brt - timedelta(hours=hours_to_filter)
        start_of_today_brt = brazil_tz.localize(datetime.combine(query_date_obj, time.min))
        if start_datetime_brt < start_of_today_brt:
            start_datetime_brt = start_of_today_brt
        print(f"[API TIME FILTER] Aplicando filtro de {hours_to_filter} hora(s) para HOJE. Intervalo: {start_datetime_brt} a {end_datetime_brt}")
    else:
        start_datetime_brt = brazil_tz.localize(datetime.combine(query_date_obj, time.min))
        end_datetime_brt = brazil_tz.localize(datetime.combine(query_date_obj, time.max))
        print(f"[API TIME FILTER] Dia inteiro para {query_date_obj}. Intervalo: {start_datetime_brt} a {end_datetime_brt}")
        
    return query_date_obj, start_datetime_brt, end_datetime_brt

@app.route('/api/results', methods=['GET'])
def get_results():
    date_str = request.args.get('date')
    time_filter_hours_str = request.args.get('time_filter_hours')

    try:
        _, start_datetime_brt, end_datetime_brt = get_date_range(date_str, time_filter_hours_str)
        resultados = db.session.query(ResultadoBlaze) \
                            .filter(ResultadoBlaze.horario_br.between(start_datetime_brt, end_datetime_brt)) \
                            .order_by(ResultadoBlaze.horario_br.desc()) \
                            .all()
        return jsonify([r.to_dict() for r in resultados]), 200
    except ValueError:
        return jsonify({"error": "Formato de data inválido. Use YYYY-MM-DD."}), 400
    except Exception as e:
        print(f"Erro inesperado na API /api/results: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"Erro interno do servidor: {str(e)}"}), 500

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    date_str = request.args.get('date')
    time_filter_hours_str = request.args.get('time_filter_hours')

    try:
        query_date_obj, start_datetime_brt, end_datetime_brt = get_date_range(date_str, time_filter_hours_str)

        resultados_do_periodo = db.session.query(ResultadoBlaze) \
            .filter(ResultadoBlaze.horario_br.between(start_datetime_brt, end_datetime_brt)) \
            .order_by(ResultadoBlaze.horario_br.asc()) \
            .all()

        total_results_period = len(resultados_do_periodo)
        
        number_counts = {str(i): 0 for i in range(15)}
        for r in resultados_do_periodo:
            if 0 <= r.numero <= 14: 
                number_counts[str(r.numero)] += 1
        
        color_stats_hourly = {}
        results_by_hour = {hour: [] for hour in range(24)} 
        for r in resultados_do_periodo:
            hour_of_result = r.horario_br.hour 
            results_by_hour[hour_of_result].append(r.cor)

        for hour, colors_in_hour_list in results_by_hour.items():
            if not colors_in_hour_list: 
                continue
            total_in_hour = len(colors_in_hour_list)
            counts_in_hour_raw = Counter(colors_in_hour_list)
            hourly_breakdown = {}
            expected_colors = ['red', 'black', 'white']
            for color_key in expected_colors:
                count = counts_in_hour_raw.get(color_key, 0)
                percentage = (count / total_in_hour) * 100 if total_in_hour > 0 else 0
                hourly_breakdown[color_key] = {"count": count, "percentage": round(percentage, 2)}
            color_stats_hourly[str(hour).zfill(2)] = {"total_results_in_hour": total_in_hour, "colors": hourly_breakdown}
        ordered_color_stats_hourly = {hour_key: color_stats_hourly[hour_key] for hour_key in sorted(color_stats_hourly.keys())}

        max_red_streak, current_red_streak = 0, 0
        max_black_streak, current_black_streak = 0, 0
        max_white_streak, current_white_streak = 0, 0
        max_streak_without_white, current_streak_without_white = 0, 0
        
        # NOVO: Cálculo do total de brancos no período
        total_whites_in_period = 0
        if resultados_do_periodo:
            for resultado in resultados_do_periodo:
                if resultado.cor == 'red':
                    current_red_streak += 1; max_red_streak = max(max_red_streak, current_red_streak)
                    current_black_streak, current_white_streak = 0, 0
                elif resultado.cor == 'black':
                    current_black_streak += 1; max_black_streak = max(max_black_streak, current_black_streak)
                    current_red_streak, current_white_streak = 0, 0
                elif resultado.cor == 'white':
                    current_white_streak += 1; max_white_streak = max(max_white_streak, current_white_streak)
                    current_red_streak, current_black_streak = 0, 0
                    total_whites_in_period += 1 # Incrementa o total de brancos
                else: # Cor desconhecida
                    current_red_streak, current_black_streak, current_white_streak = 0,0,0

                if resultado.cor == 'white': # Para sequência sem branco
                    max_streak_without_white = max(max_streak_without_white, current_streak_without_white)
                    current_streak_without_white = 0
                else:
                    current_streak_without_white += 1
            max_streak_without_white = max(max_streak_without_white, current_streak_without_white)

        sequence_stats = {
            "longest_red_streak": max_red_streak,
            "longest_black_streak": max_black_streak,
            "longest_white_streak": max_white_streak,
            "longest_streak_without_white": max_streak_without_white
        }

        statistics_response = {
            "date_requested": query_date_obj.strftime('%Y-%m-%d'),
            "time_filter_applied_hours": time_filter_hours_str if (query_date_obj == datetime.now(pytz.timezone('America/Sao_Paulo')).date() and int(time_filter_hours_str or 0) > 0) else None,
            "total_results_in_period": total_results_period,
            "total_whites_in_period": total_whites_in_period, # ADICIONADO AQUI
            "number_counts": number_counts,
            "color_stats_hourly": ordered_color_stats_hourly,
            "sequence_stats": sequence_stats
        }
        
        return jsonify(statistics_response), 200

    except ValueError:
        return jsonify({"error": "Formato de data inválido. Use YYYY-MM-DD."}), 400
    except Exception as e:
        print(f"Erro inesperado na API /api/statistics: {e}")
        import traceback 
        print(traceback.format_exc()) 
        return jsonify({"error": f"Erro interno do servidor ao calcular estatísticas: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)