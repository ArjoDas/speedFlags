import requests
import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from unidecode import unidecode

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def create_table():
    try:
        with sqlite3.connect('speedflags.db') as conn:
            cursor = conn.cursor()
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS flags (
                cca2 TEXT PRIMARY KEY,
                common TEXT NOT NULL,
                official TEXT NOT NULL,
                svg_url TEXT NOT NULL,
                svg_code TEXT NOT NULL
            )
            ''')
            conn.commit()
        logging.info("Table created successfully")
    except sqlite3.Error as e:
        logging.error(f"Error creating table: {e}")

def fetch_country_data():
    url = "https://restcountries.com/v3.1/all?fields=cca2,name,flags"
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logging.error(f"Error fetching country data: {e}")
        return []

def fetch_svg_content(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        logging.error(f"Error fetching SVG content: {e}")
        return ""

def normalize_text(text):
    return unidecode(text)

def store_country_data(country):
    try:
        cca2 = country['cca2']
        common_name = normalize_text(country['name']['common'])
        official_name = normalize_text(country['name']['official'])
        svg_url = country['flags']['svg']
        svg_code = fetch_svg_content(svg_url)
        
        with sqlite3.connect('speedflags.db') as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT OR REPLACE INTO flags (cca2, common, official, svg_url, svg_code) VALUES (?, ?, ?, ?, ?)', 
                           (cca2, common_name, official_name, svg_url, svg_code))
            conn.commit()
        
        logging.info(f"Stored data for: {cca2}")
    except KeyError as e:
        logging.error(f"KeyError in country data: {e}")
    except sqlite3.Error as e:
        logging.error(f"Database error for {cca2}: {e}")

def main():
    create_table()
    
    countries_data = fetch_country_data()
    if not countries_data:
        logging.error("Failed to fetch country data. Exiting.")
        return
    
    logging.info(f"Fetched data for {len(countries_data)} countries")
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(store_country_data, country) for country in countries_data]
        
        for future in as_completed(futures):
            pass

    # Check the number of rows in the database
    with sqlite3.connect('speedflags.db') as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM flags')
        row_count = cursor.fetchone()[0]
    
    logging.info(f"Total rows in database after execution: {row_count}")

if __name__ == "__main__":
    main()
    logging.info("Script execution completed")