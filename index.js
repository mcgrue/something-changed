var express = require('express');
var app = express();
var request = require('request');
var redis = require('redis');
var client = redis.createClient(); //creates a new client
var cheerio = require('cheerio');
var trim = require('trim');
var pretty = require('js-object-pretty-print').pretty, address, value;
var pr2 = JSON.stringify;

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

client.on('connect', function() {
    console.log('connected');
});


var data = {
  "url": "https://twitter.com/bengrue",
  "selector": "#stream-items-id > li:nth-child(2) p.js-tweet-text"
};

var make_key = function(url, selector) {
  if( !url || !selector ) {
    throw "missing required parameter, either url or selector.";
  }

  return "" + url + ";;;" + selector;
};

// http://localhost:5000/new?url=https://twitter.com/bengrue&selector=#stream-items-id > li:nth-child(2) p.js-tweet-text&notify_url=http://requestb.in/p9psnap9
// http://localhost:5000/new?url=https://twitter.com/bengrue&selector=%23stream-items-id%20%3E%20li:nth-child(2)%20p.js-tweet-text&notify_url=http://requestb.in/p9psnap9
app.get('/new', function (req, resp) {
  var q = req.query;

  if( !q.url ) {
    resp.send("Missing required parameters: url");
    return;
  }

  if( !q.selector ) {
    resp.send("Missing required parameters: selector");
    return;
  }

  if( !q.notify_url ) {
    resp.send("Missing required parameters: notify_url");
    return;
  }

  request(q.url, function(error, response, html) {
    if(!error){
      var $ = cheerio.load(html);
      var first = $($(q.selector)[0])
      var contents = first && trim(first.text());

      if( !contents ) {
        resp.send("url and selector got a result, but the selector had no contents. Aborting.");
        return;
      }

      var hash = {
        "url": q.url,
        "selector": q.selector,
        "notify_url": q.notify_url,
        "last_content": contents,
        "last_timestamp": new Date().getTime()
      };

      // todo: check if that entry already existed maybe?

      client.hmset(make_key(q.url, q.selector), hash);

      resp.send("Created new thing.<br><pre>" + pretty(hash) + "</pre>");
    } else {
      resp.send("Fuck you!");
    }
  });
});

app.get('/list', function (req, resp) {

  client.keys('*', function (err, keys) {
    if (err) {
      resp.send(err);
      return;
    }

    keys.sort();

    resp.send("<pre>"+pretty(keys)+"</pre>");
  })
});

app.get('/check', function (req, resp) {
  var q = req.query;

  if( !q.url ) {
    resp.send("Missing required parameters: url");
    return;
  }

  if( !q.selector ) {
    resp.send("Missing required parameters: selector");
    return;
  }

  client.hgetall(make_key(q.url, q.selector), function(err, reply) {

    if(err) {
      resp.send("ERROR: " + err);
    } else {
      resp.send("REPLY: <pre>" + pretty(reply) + "</pre>");
    }
  });
});


app.get('/checkall', function(req, resp) {
  client.keys('*', function (err, keys) {
    if (err) {
      resp.send(err);
      return;
    }

    keys.sort();

    var dict = {};
    var tmp = [];

    for (var i = keys.length - 1; i >= 0; i-- ) {
      tmp = keys[i].split(";;;")
      if( tmp.length > 2 ) {
        console.log("Bad number of args in split key during work, bad key: " + keys[i]);
        continue;
      }

      if( dict[tmp[0]] ) {
        dict[tmp[0]].push(tmp[1]);
      } else {
        dict[tmp[0]] = [tmp[1]];
      }
    }

    resp.send("<pre>" + pretty(dict));

  });
});


app.get('/delete', function (req, resp) {
  var q = req.query;

  if( !q.url ) {
    resp.send("Missing required parameters: url");
    return;
  }

  if( !q.selector ) {
    resp.send("Missing required parameters: selector");
    return;
  }

  var key = make_key(q.url, q.selector);

  client.del(key);

  resp.send("deleted.");
});
