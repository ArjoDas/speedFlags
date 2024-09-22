from cs50 import SQL
from flask import Flask, redirect, render_template, request, session, url_for, flash, jsonify, abort 
from flask_session import Session
# from werkzeug.security import check_password_hash, generate_password_hash   
from dotenv import load_dotenv    
from functools import wraps
import os, random
from flask_wtf.csrf import CSRFProtect

load_dotenv()

app = Flask(__name__)

# Configure session
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///speedflags.db")

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route('/autocomplete_country', methods=["GET"])
def autocomplete_country():
    query = request.args.get("q", "").lower()
    if query:
        countries = db.execute('SELECT common, official FROM flags WHERE LOWER(common) LIKE ? OR LOWER(official) LIKE ? LIMIT 5', 
                           f'%{query}%', f'%{query}%')
    else:
        countries = []
    return jsonify(countries)

@app.route('/fetch_first_svg', methods=['POST'])
def fetch_first_svg():
    random_country = db.execute('SELECT svg_code, common, official FROM flags ORDER BY RANDOM() LIMIT 1')[0]
    # random_country = db.execute('SELECT svg_code, common, official FROM flags WHERE cca2 = ?', 'AF')[0]
    session['correct_answers'] = {
        "common": random_country['common'].lower(),
        "official": random_country['official'].lower()
    }
    return jsonify({
        'svg': random_country['svg_code'],
        'common': random_country['common'],
        'official': random_country['official']
    })

@app.route('/fetch_random_svg', methods=['POST'])
def fetch_random_svg():
    random_country = db.execute('SELECT svg_code, common, official FROM flags ORDER BY RANDOM() LIMIT 1')[0]
    session['correct_answers'] = {
        "common": random_country['common'].lower(),
        "official": random_country['official'].lower()
    }
    return jsonify({'svg': random_country['svg_code']})

@app.route('/check_country_ans', methods=['POST'])
def check_country_ans():
    data = request.get_json()
    user_answer = data.get('userAnswer', '').lower()
    correct_answers = session.get('correct_answers')

    if not correct_answers:
        return jsonify({'error': 'No active game session'}), 400
    
    # is_correct is a boolean True or False
    is_correct = user_answer in [correct_answers['common'], correct_answers['official']]
    return jsonify({'answer': is_correct, 'correctAnswer': correct_answers['common']})

@app.route('/fetch_specific_cca2', methods=['POST'])
def fetch_specific_cca2():
    data = request.get_json()
    country = data.get('country')
    specific_country = db.execute('SELECT cca2 FROM flags WHERE LOWER(common) = LOWER(?)', country) # for debugging
    if specific_country[0]:
        return jsonify({'cca2': specific_country[0]['cca2']})   # for debugging
    return jsonify({'cca2': 'error'})


if __name__ == '__main__':
    app.run(debug=True)