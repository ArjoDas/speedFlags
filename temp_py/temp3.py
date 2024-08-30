import json
import requests
import sqlite3
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

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
                svg_code TEXT NOT NULL
            )
            ''')
            conn.commit()
        logging.info("Table created successfully")
    except sqlite3.Error as e:
        logging.error(f"Error creating table: {e}")

def download_and_store_svg(country_data):
    try:
        country_code = country_data['cca2']
        url = country_data['flags']['svg']
        common_name = country_data['name']['common']
        official_name = country_data['name']['official']
    except KeyError as e:
        logging.error(f"KeyError in country data: {e}")
        return

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        svg_code = response.text
        
        with sqlite3.connect('speedflags.db') as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT OR REPLACE INTO flags (cca2, common, official, svg_code) VALUES (?, ?, ?, ?)', 
                           (country_code, common_name, official_name, svg_code))
            conn.commit()
        
        logging.info(f"Downloaded and stored: {country_code}")
    except requests.RequestException as e:
        logging.error(f"Error downloading {country_code}: {e}")
    except sqlite3.Error as e:
        logging.error(f"Database error for {country_code}: {e}")

def main():
    try:
        # Load the JSON file
        with open('/Users/arjodas/Desktop/Active_Projects/CS50fp/static/data/countries.json', 'r') as f:
            countries_data = json.load(f)
        
        logging.info(f"Loaded {len(countries_data)} countries from JSON file")
        
        # Create the table
        create_table()
        
        # Use ThreadPoolExecutor for concurrent downloads
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(download_and_store_svg, country_data) for country_data in countries_data]
            
            # Wait for all downloads to complete
            for future in as_completed(futures):
                pass

        # Check the number of rows in the database
        with sqlite3.connect('speedflags.db') as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM flags')
            row_count = cursor.fetchone()[0]
        
        logging.info(f"Total rows in database after execution: {row_count}")

    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON file: {e}")
    except FileNotFoundError as e:
        logging.error(f"File not found: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
    logging.info("Script execution completed")