/**
 * DNSode - Experimental pure node.js implemention DNS server
 * 
 * @package	dnsode.js
 * @author	Tomas Aparicio <tomas@rijndael-project.com>
 * @version	0.1.1 Alpha - 26/11/2011 
 * @licence	GNU Affero GPL 3.0
 *
 * Copyright (C) 2011 Tomas Aparicio <tomas@rijndael-project.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

var sys = require('util'),
    Buffer = require('buffer').Buffer,
    udp = require('dgram'),
	fs = require('fs'),
	dns = require('dns');

var DNSode = function ()
{
	var parent = this;
	
	fs.readFile('./dnsode.conf.json', 'utf8', function (err, data) {
	  
		if (err) throw err;
		console.log(data);
		data = eval(data);
		console.log(' Config ->  ' + typeof data);
		//data = JSON.parse(data);
		//console.log(' PORT -> ' + data.server.port);
		//console.log(process.versions);
		parent.conf = data;
		//startServer(data.server);
	  
	});	
	
	var startServer = function (config)
	{
		createServer();
		server.bind(config.port); // listen on all interfaces
		server.on('request',request);
	}
	
	/*
	exports.Server = Server;
	sys.inherits(exports.Server, udp.Socket);
	exports.createServer = function() {
		return new Server();
	}
	*/
	
	/**
	 * @private
	 */
	var Server = function () 
	{
		udp.Socket.call(this, 'udp4');
		var self = this;
		this.on('message', function(msg, rinfo) {
			//split up the message into the dns request header info and the query
			var request = processRequest(msg);
			var response = new Response(self, rinfo, request);
			this.emit('request', request, response);
		});
	}
	
	var request = function (req, res)
	{
		var question = req.question;
		
		var zones = {
		  'fiwall.net' : {
				 A : {
					'fiwall.net' : {
						ttl : 3600, // ttl	
						data : '172.20.0.3', // record
					},
					'www.fiwall.net' : {
						ttl : 3600, // ttl	
						data : '172.20.0.3', // record
					},
					'lab.fiwall.net' : {
						ttl : 3600, // ttl	
						data : '172.20.0.3', // record
					},
					'gw.fiwall.net' : {
						ttl : 3600, // ttl	
						data : '172.20.0.4', // record
					},
					'ns.fiwall.net' : {
						ttl : 3600, // ttl	
						data : '172.20.0.3', // record
					}
				 },
				 
				 NS : {
					'ns.fiwall.net' : {
						ttl : 3600, // ttl	
						data : 'ns.fiwall.net', // record
					},
				 },
				 
				 PTR : {
					'172_20_0_3' : {
						ttl : 3600, // ttl	
						data : 'fiwall.net', // record
					},
				 },
				 
				 // IPv6 records
				 AAAA : {
					'fiwall.net' : {
						ttl : 3600, // ttl	
						data : '2001:0DB8::1428:57ab', // record
					},
				 }
			 },
		  };
		
		// record
		var getRecord = function (type,name)
		{
			if (typeof type != 'undefined' && typeof name != 'undefined')
			{
			 
				switch (type) 
				{
					case 1: type = 'A'; break;
					case 2: type = 'NS'; break;
					case 5: type = 'CNAME'; break;
					case 6: type = 'SOA'; break;
					case 12: type = 'PTR'; break;
					case 15: type = 'MX'; break;
					case 16: type = 'TEXT'; break;
					//case 28: type = 'AAAA'; break;
					case 33: type = 'SVR'; break;
					default: type = 'A'; break;
				}
				
				var sld = name.split('.');
				sld = sld[sld.length-2] + '.' + sld[sld.length-1];
				
				for (var i in zones)
				{
					if (i == sld)
					{
						for (var x in zones[i]) 
						{
							if (x == type)
							{
								for (var z in zones[i][x])
								{
									//console.log('ZONA -> "' + z + '" -> "' + name + '"');
									if (z == name)
									{
										return [zones[i][x][z].ttl,zones[i][x][z].data];	
									}
								}
							}
						}
					}			
				}
				
				return false;
				
			} else {
				throw e;
			}	  
		}
		
		//console.log('ARCHIVO ZONA -> ' + zones.fiwallnet.A.fiwallnet.data);
		console.log('TYPE -> ' + question.type );
		
		var record = getRecord(question.type,question.name);
		if (typeof record == 'object')
		{
			res.addRR(question.name, question.type, question.class, record[0], record[1]); 
			console.log('NEW REQUEST -> Host: "' + question.name + '" TTL: ' + record[0] + ' Data: ' + record[1]);
		} else {
			res.header.rcode = 3; // NXDOMAIN
		}
				
		res.send(); // send the result
	}
	
	//takes a buffer as a request
	var processRequest = function (req) 
	{
	  //see rfc1035 for more details
	  //http://tools.ietf.org/html/rfc1035#section-4.1.1
	
	  var query = {};
	  query.header = {};
	  //TODO write code to break questions up into an array
	  query.question = {};
	
	  var tmpSlice;
	  var tmpByte;
	
	  //transaction id
	  // 2 bytes
	  query.header.id = req.slice(0,2);
	
	  //slice out a byte for the next section to dice into binary.
	  tmpSlice = req.slice(2,3);
	  //convert the binary buf into a string and then pull the char code
	  //for the byte
	  tmpByte = tmpSlice.toString('binary', 0, 1).charCodeAt(0);
	
	  //qr
	  // 1 bit
	  query.header.qr = sliceBits(tmpByte, 0,1);
	  //opcode
	  // 0 = standard, 1 = inverse, 2 = server status, 3-15 reserved
	  // 4 bits
	  query.header.opcode = sliceBits(tmpByte, 1,4);
	  //authorative answer
	  // 1 bit
	  query.header.aa = sliceBits(tmpByte, 5,1);
	  //truncated
	  // 1 bit
	  query.header.tc = sliceBits(tmpByte, 6,1);
	  //recursion desired
	  // 1 bit
	  query.header.rd = sliceBits(tmpByte, 7,1);
	
	  //slice out a byte to dice into binary
	  tmpSlice = req.slice(3,4);
	  //convert the binary buf into a string and then pull the char code
	  //for the byte
	  tmpByte = tmpSlice.toString('binary', 0, 1).charCodeAt(0);
	
	  //recursion available
	  // 1 bit
	  query.header.ra = sliceBits(tmpByte, 0,1);
	
	  //reserved 3 bits
	  // rfc says always 0
	  query.header.z = sliceBits(tmpByte, 1,3);
	
	  //response code
	  // 0 = no error, 1 = format error, 2 = server failure
	  // 3 = name error, 4 = not implemented, 5 = refused
	  // 6-15 reserved
	  // 4 bits
	  query.header.rcode = sliceBits(tmpByte, 4,4);
	
	  //question count
	  // 2 bytes
	  query.header.qdcount = req.slice(4,6);
	  //answer count
	  // 2 bytes
	  query.header.ancount = req.slice(6,8);
	  //ns count
	  // 2 bytes
	  query.header.nscount = req.slice(8,10);
	  //addition resources count
	  // 2 bytes
	  query.header.arcount = req.slice(10, 12);
	
	  //assuming one question
	  //qname is the sequence of domain labels
	  //qname length is not fixed however it is 4
	  //octets from the end of the buffer
	  query.question.qname = req.slice(12, req.length - 4);
	  //qtype
	  query.question.qtype = req.slice(req.length - 4, req.length - 2);
	  //qclass
	  query.question.qclass = req.slice(req.length - 2, req.length);
	
	  query.question.name = qnameToDomain(query.question.qname);
	  query.question.type = query.question.qtype[0] * 256 + query.question.qtype[1];
	  query.question.class = query.question.qclass[0] * 256 + query.question.qclass[1];
	
	  return query;
	}
	
	var Response = function (socket, rinfo, query)
	{
	  this.socket = socket;
	  this.rinfo = rinfo;
	  this.header = {};
	
	  //1 byte
	  this.header.id = query.header.id; //same as query id
	
	  //combined 1 byte
	  this.header.qr = 1; //this is a response
	  this.header.opcode = 0; //standard for now TODO: add other types 4-bit!
	  this.header.aa = 0; //authority... TODO this should be modal
	  this.header.tc = 0; //truncation
	  this.header.rd = 1; //recursion asked for
	
	  //combined 1 byte
	  this.header.ra = 0; //no rescursion here TODO
	  this.header.z = 0; // spec says this MUST always be 0. 3bit
	  this.header.rcode = 0; // TODO add error codes 4 bit.
	
	  //1 byte
	  this.header.qdcount = 1; //1 question
	  //1 byte
	  this.header.ancount = 0; //number of rrs returned from query
	  //1 byte
	  this.header.nscount = 0;
	  //1 byte
	  this.header.arcount = 0;
	
	  this.question = {};
	  this.question.qname = query.question.qname;
	  this.question.qtype = query.question.qtype;
	  this.question.qclass = query.question.qclass;
	
	  this.rr = [];
	}
	
	Response.prototype.addRR = function(domain, qtype, qclass, ttl, rdlength, rdata) {
	  var r = {}, address;
	  r.qname = domainToQname(domain);
	  r.qtype = qtype;
	  r.qclass = qclass;
	  r.ttl = ttl;
	
	  if (address = inet_aton(rdlength)) {
		r.rdlength = 4;
		r.rdata = address;
	  } else {
		r.rdlength = rdlength;
		r.rdata = rdata;
	  }
	
	  this.rr.push(r);
	  this.header.ancount++;
	}
	
	Response.prototype.send = function(callback) {
	  var buffer = this.toBuffer();
	  this.socket.send(buffer, 0, buffer.length, this.rinfo.port, this.rinfo.address, callback || function() {});
	}
	
	Response.prototype.toBuffer = function() {
	  //calculate len in octets
	  //NB not calculating rr this is done later
	  //headers(12) + qname(qname + 2 + 2)
	  //e.g. 16 + 2 * qname;
	  //qnames are Buffers so length is already in octs
	  var qnameLen = this.question.qname.length;
	  var len = 16 + qnameLen;
	  var buf = getZeroBuf(len);
	
	  this.header.id.copy(buf, 0, 0, 2);
	
	  buf[2] = 0x00 | this.header.qr << 7 | this.header.opcode << 3 | this.header.aa << 2 | this.header.tc << 1 | this.header.rd;
	
	
	  buf[3] = 0x00 | this.header.ra << 7 | this.header.z << 4 | this.header.rcode;
	
	  numToBuffer(buf, 4, this.header.qdcount, 2);
	
	  numToBuffer(buf, 6, this.header.ancount, 2);
	  numToBuffer(buf, 8, this.header.nscount, 2);
	  numToBuffer(buf, 10, this.header.arcount, 2);
	
	  //end header
	
	  this.question.qname.copy(buf, 12, 0, qnameLen);
	  this.question.qtype.copy(buf, 12+qnameLen, 0, 2);
	  this.question.qclass.copy(buf, 12+qnameLen+2, 0, 2);
	
	  var rrStart = 12+qnameLen+4;
	
	  for (var i = 0; i < this.rr.length; i++) 
	  {
		//TODO figure out if this is actually cheaper than just iterating
		//over the rr section up front and counting before creating buf
		//
		//create a new buffer to hold the request plus the rr
		//len of each response is 14 bytes of stuff + qname len
		var tmpBuf = getZeroBuf(buf.length + this.rr[i].qname.length + 14);
	
		buf.copy(tmpBuf, 0, 0, buf.length);
	
		this.rr[i].qname.copy(tmpBuf, rrStart, 0, this.rr[i].qname.length);
		numToBuffer(tmpBuf, rrStart+this.rr[i].qname.length, this.rr[i].qtype, 2);
		numToBuffer(tmpBuf, rrStart+this.rr[i].qname.length+2, this.rr[i].qclass, 2);
	
		numToBuffer(tmpBuf, rrStart+this.rr[i].qname.length+4, this.rr[i].ttl, 4);
		numToBuffer(tmpBuf, rrStart+this.rr[i].qname.length+8, this.rr[i].rdlength, 2);
		numToBuffer(tmpBuf, rrStart+this.rr[i].qname.length+10, this.rr[i].rdata, this.rr[i].rdlength); // rdlength indicates rdata length
	
		rrStart = rrStart + this.rr[i].qname.length + 14;
	
		buf = tmpBuf;
	  }
	
	  //TODO compression
	  return buf;
	  
	}

	var inet_aton = function (address) 
	{
	  var parts = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	  return parts ? parts[1] * 16777216 + parts[2] * 65536 + parts[3] * 256 + parts[4] * 1 : false;
	}

	var domainToQname = function (domain) 
	{
	  var tokens = domain.split(".");
	  var len = domain.length + 2;
	  var qname = new Buffer(len);
	  var offset = 0;
	  for (var i = 0; i < tokens.length; i++) {
		qname[offset] = tokens[i].length;
		offset++;
		for (var j = 0; j < tokens[i].length; j++) {
		  qname[offset] = tokens[i].charCodeAt(j);
		  offset++;
		}
	  }
	  qname[offset] = 0;
	
	  return qname;
	}
	
	var getZeroBuf = function (len) 
	{
	  var buf = new Buffer(len);
	  for (var i = 0; i < buf.length; i++) buf[i] = 0;
	  return buf;
	}
	
	//take a number and make sure it's written to the buffer as
	//the correct length of bytes with leading 0 padding where necessary
	// takes buffer, offset, number, length in bytes to insert
	var numToBuffer = function (buf, offset, num, len, debug)
	{
	  if (typeof num != 'number') {
		throw new Error('Num must be a number');
	  }
	
	  for (var i = offset; i < offset + len; i++) {
		var shift = 8*((len - 1) - (i - offset));
		var insert = (num >> shift) & 255;
		buf[i] = insert;
	  }
	
	  return buf;
	}
	
	var qnameToDomain = function (qname) 
	{
	  var domain= '';
	  for (var i = 0; i < qname.length; i++) {
		if (qname[i] == 0) {
		  //last char chop trailing .
		  domain = domain.substring(0, domain.length - 1);
		  break;
		}
	
		var tmpBuf = qname.slice(i+1, i+qname[i]+1);
		domain += tmpBuf.toString('binary', 0, tmpBuf.length);
		domain += '.';
	
		i = i + qname[i];
	  }
	
	  return domain;
	}

	return this;	
	
}

new DNSode();

/*
fs.readFile('./dnsode.json', 'utf8', function (err, data) {
  
  if (err) throw err;
  console.log(data);

  data = JSON.parse(data);
  console.log(' PORT -> ' + data.server.port);
  
});
*/
