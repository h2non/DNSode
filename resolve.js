var dns = require('dns');

var object = {
	zone : {
		record : {
			A : {
				data : '172.20.0.1'	
			}
		}
	},
	type: {
		ttl : 'area'
	}
};

var json = JSON.stringify(object);
console.log ('JSON -> ' + json);

json.replace('{',"{\n");
json.replace('}',"}\n");

dns.resolve('www.google.com',rrtype='A', function (err, addresses) {
  if (err) throw err;

  console.log('addresses: ' + JSON.stringify(addresses));

	for (var x in addresses)
	{
		console.log(x + ' -> ' + addresses[x]);	
	}

  addresses.forEach(function (a) {
    dns.reverse(a, function (err, domains) {
      if (err) {
        console.log('reverse for ' + a + ' failed: ' +
          err.message);
      } else {
        console.log('reverse for ' + a + ': ' +
          JSON.stringify(domains));
      }
    });
  });
});