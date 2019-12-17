const express = require('express');
const app = express();
const port = 3000;
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fetch = require('node-fetch');
const adapter = new FileSync('db.json');
const db = low(adapter);
const scheduler = require('node-schedule');
const uuid = require('uuid');

Date.prototype.withoutTime = function () {
    var d = new Date(this);
    d.setHours(0, 0, 0, 0);
    return d;
}

const cities = ['Lodz', 'Warsaw', 'Wroclaw', 'Szczecin', 'Rzeszow', 'Gdansk', 'Suwalki'];
const properties = ["temperature", "pressure", "humidity", "precipitation", "windSpeed", "windDirection"];
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
db.defaults({ weather_data: [],  authrized_keys: ["210d4206-f3df-42db-8638-914820b88a92"]}).write();

if(db.get('weather_data').some(data => {
		let day = new Date(data.day);
		let today = new Date();
		return (today.withoutTime().getTime() === day.withoutTime().getTime());
	}) == false) {
	console.log("No data for today found");
	getWeatherDataForAllCities();
}

scheduler.scheduleJob('0 0 0,12 ? * * *', getWeatherDataForAllCities);

app.listen(port, () => console.log(`Listening on port ${port}!`));
app.set('view engine', 'pug');

app.get('/key', (req, res) => {
	const new_key = uuid();
	db.get('authrized_keys').push(new_key).write();
	res.send(new_key);
});

app.get('/', (req, res) => {
	let map = {
		"temperature": {},
		"pressure": {}, 
		"humidity": {}, 
		"precipitation": {}, 
		"windSpeed": {}, 
		"windDirection": {}
	}
	promises = [];
	cities.forEach(city => {
		properties.forEach(property => {
			promises.push(fetch(`http://localhost:3000/average?d=${100}&c=${city}&p=${property}&key=210d4206-f3df-42db-8638-914820b88a92`).then(res => res.json()));
			promises.push(fetch(`http://localhost:3000/poland?d=${100}&p=${property}&key=210d4206-f3df-42db-8638-914820b88a92`).then(res => res.json()))
		});
	})
	Promise.all(promises).then(r => {
		r.forEach(elem => {
			if(!elem.city) {
				elem.city='Poland'
			}
			map[elem.property_name][elem.city] = elem.property_value 
		});
		res.render('index', {title: "Weather", cities: cities, map: map, properties: properties});
	});
});

app.use(function (req, res, next) {
	const key = req.query.key;
	if(!key || db.get('authrized_keys').some(k => k === key) == false) {
		res.status(401).json({ message: "Unauthorized request" });
	}
	else {
		next();
	}
});

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
	if(!city || !property || !days) {
		return res.sendStatus(400);
	}
	let city_data = db.get('weather_data')
					  .sortBy(data => data.day)
					  .take(days)
					  .map(days => days.cities)
					  .value()
					  .reduce((acc, val) => acc.concat(val), []);
	var map = {};
	city_data.forEach(e => {
		if(!map[e.city]) {
			map[e.city] = [];
		}
		map[e.city].push(e.data);
	});
	const avg_size = map[city].length;
	let avg = 0;
	map[city].forEach(data => {
		avg += data[property];
	});
	avg /= avg_size;
	if(isNaN(avg)) {
		avg = 0;
	}
    res.send(
        {
            city: city,
            property_name: property,
            property_value: avg.toFixed(2)
        }
    );
});

app.get('/poland', (req, res) => {
    const property = req.query.p;
	const days = req.query.d;
	if(!property || !days) {
		return res.sendStatus(400);
	}
	let city_data = db.get('weather_data')
					  .sortBy(data => data.day)
					  .take(days)
					  .map(days => days.cities)
					  .value()
					  .reduce((acc, val) => acc.concat(val), []);
	const avg_size = city_data.length;
	let avg = 0;
	city_data.forEach(city => {
		avg += city.data[property];
	});
	avg /= avg_size;
	if(isNaN(avg)) {
		avg = 0;
	}
    res.send(
        {
            property_name: property,
            property_value: avg.toFixed(2)
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