from cs50 import SQL
from flask import Flask, redirect, render_template, request, session, url_for, flash, jsonify, abort 
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash   
from dotenv import load_dotenv    
from functools import wraps
import os, random
from flask_wtf.csrf import CSRFProtect


# Add this to your fetch calls in JavaScript
# headers: {
#     'Content-Type': 'application/json',
#     'X-CSRFToken': '{{ csrf_token() }}'
# },

# Load environment variables
load_dotenv()

# Defines app
app = Flask(__name__)

# Enables Cross Site Request Forgery
# csrf = CSRFProtect(app)

# Configure session
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///speedflags.db")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        # Implement registration logic here
        pass
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    session.clear()
    if request.method == "POST":
        # Implement login logic here
        pass
    return render_template("login.html")

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


# n e w   f e t c h (s)   a n d   c h e c k    v e r s i o n

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


@app.route('/set_game_duration', methods=['POST'])
def set_game_duration():
    data = request.get_json()
    duration = data.get('duration')
    if duration:
        session['game_duration'] = duration
        return jsonify({'success': True}), 200
    return jsonify({'error': 'Invalid duration'}), 400


@app.route('/experiment', methods=['GET'])
def experiment():
    return render_template("experiment.html")

@app.route('/experiment2', methods=['GET'])
def experiment2():
    return render_template("experiment2.html")

if __name__ == '__main__':
    app.run(debug=True)