#!/usr/bin/env node

var mongojs = require('mongojs'),
    url = process.env.MONGOHQ_URL || 'mongodb://localhost/concertdacote',
	db = mongojs(url, ['concerts']);

/*
 * inserting data into database
 */
function getData(data) {
    db.concerts.insert(data);
    console.log('data inserted successfully!\n');
}

function removeData(){
	db.concerts.remove();
}

function 2DIndex(){
	db.concerts.ensureIndex({latlong : "2d"});
}

exports.removeData = removeData;
exports.getData = getData;
exports.2DIndex = 2DIndex;