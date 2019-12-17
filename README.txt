To run the project, first type
> npm install
to install all necessary dependencies.

Then run 
> node index.js
and the server should start listening on port 3000.

The database is in the file db.js, if the file is not present, the database will rebuild its structure.

Available cities = Lodz, Warsaw, Wroclaw, Szczecin, Rzeszow, Gdansk, Suwalki
Available properties = temperature, pressure, humidity, precipitation, windSpeed, windDirection

Available endpoints:

GET
/ -> shows the table with all weather data
/key -> provides an api key to authorise requests
/dbsize?key=API_KEY -> returns the size of the database (number of weather measurements)
/average?c=CITY&p=PROPERTY&d=DAYS&key=API_KEY -> returns the average of a PROPERTY in a given CITY over DAYS days
/poland?p=PROPERTY&d=DAYS&key=API_KEY -> returns the average of a PROPERTY in Poland over DAYS days