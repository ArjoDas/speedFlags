import requests
import json


def generate_country_code_dict():
    url = "https://restcountries.com/v3.1/all?fields=name,cca2"
    response = requests.get(url)
    countries = response.json()

    country_dict = {}
    for country in countries:
        name = country['name']['common']
        code = country['cca2']
        country_dict[name] = code

    return country_dict

# Generate the dictionary
country_codes = generate_country_code_dict()

# Print the dictionary
print(json.dumps(country_codes, indent=2))
