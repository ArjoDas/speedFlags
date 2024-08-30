from cs50 import SQL
from flask import Flask, redirect, render_template, request, session, url_for, flash, jsonify, abort 
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash   
from dotenv import load_dotenv    
from functools import wraps
import os, json, random, requests
from pathlib import Path
from cachetools import TTLCache

'''generate a sqlite3 table with 2a country codes against flag svg strings'''

def generate_country_flag_dict():
    url = "https://restcountries.com/v3.1/all?fields=cca2,flags"
    response = requests.get(url)
    countries = response.json()

    a2flag = {}
    for country in countries:
        code = country['cca2']
        flag = country.get('flags', {}).get('svg')
        a2flag[code] = flag
    return a2flag

# Generate the dictionary
a2flag = generate_country_flag_dict()

# Print the dictionary
print(json.dumps(a2flag, indent=2))