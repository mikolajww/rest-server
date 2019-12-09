const express = require('express');
const app = express();
const port = 3000;
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fetch = require('node-fetch');
const adapter = new FileSync('db.json');
const db = low(adapter);
const scheduler = require('node-schedule');

Date.prototype.withoutTime = function () {
    var d = new Date(this);
    d.setHours(0, 0, 0, 0);
    return d;
}

const cities = ['Lodz', 'Warszawa', 'Wroclaw', 'Szczecin', 'Rzeszow', 'Gdansk', 'Suwalki'];
const API_KEY = '8835e5a77fa77f31382ae1778b90042d';

//api.openweathermap.org/data/2.5/weather?q={city name},{country code}
const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather?q='

// Set some defaults (required if your JSON file is empty)
// db structure:
		// weather_data: [
		// 	{
		// 		day:
		// 		cities: [
		// 			data: {
		//			
		// 			}
		// 		]
		// 	}
		// ]
//
//
db.defaults({ weather_data: [],  authrized_keys: []}).write();

if(db.get('weather_data').some(data => {
		let day = new Date(data.day);
		let today = new Date();
		return (today.withoutTime().getTime() === day.withoutTime().getTime());
	}) == false) {
	console.log("No data for today found");
	getWeatherDataForAllCities();
}

scheduler.scheduleJob('*/10 * * * *', getWeatherDataForAllCities);

app.listen(port, () => console.log(`Listening on port ${port}!`));

app.get('/dbsize', (req, res) => {
	const size = db.get('weather_data').size();
	res.send(
		{
			size: size,
		}
	);
});

app.get('/average', (req, res) => {
    const city = req.query.c;
    const property = req.query.p;
    const days = req.query.d;
    var city_data = db.get('weather_data').take(days).map(days => days.cities).value();
    //city_data = city_data.filter(cities => cities.city === city);
    console.log(city_data)
    var avg = 0;
    var prop = city_data[0].filter(c => c.city === city).map(city => city.data[property]);
    console.log(prop);
    res.send(
        {
            city: city,
            property_name: property,
            property_value: prop
        }
    );
});

function getUrlForCity(city) {
	return `${WEATHER_URL}${city},pl&APPID=${API_KEY}&units=metric`;
}

async function getWeatherData(city) {
	return await fetch(getUrlForCity(city))
		.then(res => res.json())
		.catch(err => console.log(err));
}

function parseWeatherResponseForCity(json) {
	return {
		temperature: json.main.temp,
		pressure: json.main.pressure,
		humidity: json.main.humidity,
		precipitation: json.rain ? json.rain['3h'] : 0,
		windSpeed: json.wind.speed,
		windDirection: json.wind.deg
	}
}

async function getWeatherDataForAllCities() {
	return Promise.all(cities.map(getWeatherData)).then(res => {
		let weather_data = {
			day: new Date(res[0].dt * 1000).toISOString(),
			cities: new Array()
		}
		res.forEach(city_data => {
			weather_data.cities.push(
				{
					city: city_data.name,
					data: parseWeatherResponseForCity(city_data)
				}
			);
		});
	
		db.get('weather_data')
		  .push(weather_data)
		  .write();
		console.log("Fetched weather data for all cities");
		return weather_data;
	});
}