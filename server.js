#!/usr/bin/env node
var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -sport [string, seraiport name] -uport [num,reporting port] -uaddress [string, like "127.0.0.1" or "ventmon.coslabs.com"]')
    .default('sport', "COM4")
    .default('uport', 6111)
    .default('uaddress', "127.0.0.1")
    .demandOption(['sport','uport','uaddress'])
    .argv;
var express = require('express');
const cors = require('cors');
var app = express();
app.use(cors());
const SerialPort = require('serialport'); //https://serialport.io/docs/guide-usage
const Readline = require('@serialport/parser-readline');

const sport_name = argv.sport;
const uport = argv.uport;
const uaddress = argv.uaddress;

console.log("Parameters:");
console.log("argv.sport",argv.sport);
console.log("sport_name (Serial Port name)",sport_name);
console.log("uport (UDP port)",uport);
console.log("uaddress (UDP address)",uaddress);


const sport = new SerialPort(sport_name, { baudRate: 19200 });

const parser = sport.pipe(new Readline());// Read the port data

// Rob is adding the ability to send UDP datagrams to make this work with our datalake!
// Okay, this code basically works---but I might have to fill a byte buffer.
const dgram = require('dgram');

sport.on("open", () => {
  console.log('serial port open');
});

// Open errors will be emitted as an error event
sport.on('error', function(err) {
  console.log('Error: ', err.message)
})


parser.on('data', data =>{
  // Let's see if the data is a PIRDS event...
  // Note: The PIRDSlogger accepts JSON, but I'm not sure we ever implemented that
  // being interpreted as a message. That possibly should be fixed, but I'm going to just
  // construct a buffer here.
    const message = new Buffer(data);
    const client = dgram.createSocket('udp4');
    //    client.send(message, 0, message.length, 6111,"ventmon.coslabs.com", (err) => {
  client.send(message, 0, message.length, uport, uaddress, (err) => {
    if (err) {
      console.log(err);
    }
      client.close();
    });
  console.log(data);
});


// parser.on('data', console.log)

app.get('/', function(req, res) {
	res.send('Hello world');
	sport.write('hello world\n', (err) => {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});
})

app.get('/api/set', function(req, res) {
    var x = '';
	if (req.query.rr){
		x += '{"rr":"' + req.query.rr + '"}\n';
	}
	res.send(x);

	sport.write(x, (err) => {
		//console.log('wrote to port ' + x);
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});
});

// /api/pircs?com=C&par=P&int=T&mod=0&val=400
app.get('/api/pircs', function(req, res) {
	var err = '';
    var x = '{ ';
	if (req.query.com){
		x += '"com" : "' + req.query.com + '" , ';
	} else {
		err += "com not defined! ";
	}
	if (req.query.par){
		x += '"par" : "' + req.query.par + '" , ';
	} else {
		err += "par not defined! ";
	}
	if (req.query.int){
		x += '"int" : "' + req.query.int + '" , ';
	} else {
		err += "int not defined! ";
	}
	if (req.query.mod){
		x += '"mod" : ' + req.query.mod + ' , ';
	} else {
		err += "mod not defined! ";
	}
	if (req.query.val){
		x += '"val" : ' + req.query.val;
	} else {
		err += "val not defined! ";
	}
	x += ' }\n';

	if (err.length > 0){
		err += "\n"
		res.setHeader("Content-Type", "text/plain");
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(400).send(err);
	} else {

		res.setHeader("Content-Type", "application/json");
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(200).send(x);
          console.log("About to write:");
          console.log(x);
          console.log("done");
		sport.write(x, (err) => {
			if (err) {
			return console.log('Error on write: ', err.message);
			}
		});
	}

	// { "com" : "C" , "par" : "P" , "int" : "T" , "mod" : 0 , "val" : 400 }
});

// /api/pircs2/C/P/T/0/400
app.get('/api/pircs2/:com/:par/:int/:mod/:val', function(req,res) {
	res.send(req.params);
	sport.write(JSON.stringify(req.params)+'\n', (err) => {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});

	// JSON.stringify returns: {"com":"C","par":"P","int":"T","mod":"0","val":"400"}
})

/*app.get('/rr/:rr', function(req,res) {
	res.send(req.params);
	port.write(JSON.stringify(req.params)+'\n', (err) => {
		if (err) {
		  return console.log('Error on write: ', err.message);
		}
	});
})*/

var server = app.listen(5000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log("Node.js server running on port %s", port);
})
