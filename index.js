var express = require('express');
var app = express();
var request = require('request');

if (process.env.REDISTOGO_URL) {
  var rtg   = require("url").parse(process.env.REDISTOGO_URL);
  var redis = require("redis");
  var client = redis.createClient(rtg.port, rtg.hostname);

  client.auth(rtg.auth.split(":")[1]);
} else {
  var redis = require("redis");
  var client = redis.createClient(); //creates a new client
}


var cheerio = require('cheerio');
var trim = require('trim');
var pretty = require('js-object-pretty-print').pretty, address, value;
var pr2 = JSON.stringify;

// var Promise = require("bluebird");
// Promise.promisifyAll(redis.RedisClient.prototype);
// Promise.promisifyAll(redis.Multi.prototype);

app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use('/static', express.static('public'))

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/htmlnew', function(request, response) {
  response.render('pages/new');
});

app.get('/htmledit', (request, response) => {

  var q = request.query;

  if( !q.url ) {
    request.send("Missing required parameters: url");
    return;
  }

  if( !q.selector ) {
    request.send("Missing required parameters: selector or json");
    return;
  }

  response.render('pages/edit', {url: q.url, selector: q.selector});
});

app.get('/htmllist', function(request, response) {

  client.keys('*', function (err, keys) {
    if (err) {
      resp.send(err);
      return;
    }

    keys.sort();

    keys = keys.map( (val) => {
      var a = val.split(";;;");
      return {url:a[0], selector:a[1], key:val};
    } );

    response.render('pages/list', {results:keys, filter:(inp) => {
      return encodeURI(inp).replace(/#/g, "%23");
    }});
  });
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

var make_key = function(url, selector, json) {
  if( !selector && json ) {
    selector = "JSON";
  }

  if( !url || !selector ) {
    throw "missing required parameter, either url or selector.";
  }

  return "" + url + ";;;" + selector;
};

var makeRequest = (url) => {
  return {
    url: url,
    headers: {
      'User-Agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36"
    }
  };
};

// http://localhost:5000/new?url=https://twitter.com/bengrue&selector=#stream-items-id > li:nth-child(2) p.js-tweet-text&notify_url=http://requestb.in/p9psnap9
// http://localhost:5000/new?url=https://twitter.com/bengrue&selector=%23stream-items-id%20%3E%20li:nth-child(2)%20p.js-tweet-text&notify_url=http://requestb.in/p9psnap9
app.get('/new', function (req, resp) {
  var q = req.query;

  if( !q.url ) {
    resp.send("Missing required parameters: url");
    return;
  }

  if( !q.selector && !q.json ) {
    resp.send("Missing required parameters: selector or json");
    return;
  }

  if( !q.notify_url ) {
    resp.send("Missing required parameters: notify_url");
    return;
  }

  try {
    request(makeRequest(q.url), function(error, response, html) {
      if(!error){
        var contents = "";

        if( q.json ) {
          /// TODO : check mime-type json?
          contents = JSON.parse(html);
        } else {
          var $ = cheerio.load(html);
          var first = $($(q.selector)[0])
          contents = first && trim(first.text());
        }

        if( !contents ) {
          resp.send("url and selector got a result, but the selector had no contents. Aborting.");
          return;
        }

        if( typeof contents == "object" ) {
          contents = JSON.stringify(contents);
        }

        var hash = {
          "url": q.url,
          "notify_url": q.notify_url,
          "last_content": contents,
          "last_checked_timestamp": new Date().getTime(),
          "last_updated_timestamp": new Date().getTime()
        };

        if(q.selector) {
          hash["selector"] = q.selector;
        }
        else if(q.json) {
          hash["json"] = true;
        }

        // todo: check if that entry already existed maybe?

        console.log()

        client.hmset(make_key(q.url, q.selector, q.json), hash);

        resp.type('json');
        resp.jsonp(hash);
      } else {
        res.status(500).send("Something done fucked up.");
      }
    });
  } catch( e ) {
    res.status(500).send("error during fetch: " + e.message);
  }
});

app.get('/list', function (req, resp) {

  client.keys('*', function (err, keys) {
    if (err) {
      resp.send(err);
      return;
    }

    keys.sort();

    resp.type('json');
    resp.jsonp(keys);
  })
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

    var results = [];
    tmp = "";

    for( var website in dict ) {
      tmp = do_website( website, dict[website] );
      results.push( [website] );
    }

    resp.send("<pre>" + pretty(results));
  });
});

var getKeysFromURL = (fullPath) => {

  console.log(fullPath);
  var getPosition = (str, m, i) => {
     return str.split(m, i).join(m).length;
  }

  var pos = getPosition(fullPath, '/', 2);
  console.log(pos);
  var particle = fullPath.substring(pos+1, fullPath.length);
  console.log(particle);

  return particle.split(";;;");
}

app.get('/check*', function (req, resp) {
  var q = req.query;
  var url = q.url || "";
  var selector = q.selector || "";

  if( !selector && !url ) {
    var ar = getKeysFromURL(req.path);
    if( ar.length == 2 ) {
      url = ar[0];
      selector = ar[1];
    }

    console.log(ar)
  }

  if( !url ) {
    resp.send("Missing required parameters: url");
    return;
  }

  if( !selector ) {
    resp.send("Missing required parameters: selector");
    return;
  }

  client.hgetall(make_key(url, selector), function(err, reply) {

    if(err) {
      resp.send("ERROR: " + err);
    } else {

      if( reply && reply.json ) {
        reply.last_content = JSON.parse(reply.last_content);
      }

      resp.type('json');
      resp.jsonp(reply);
    }
  });
});

var superlog = function(msg, results) {
  console.log(msg);
  if(results) results.push(msg); /// TODO: not working as intended due to async code.  Promisification in the future?
}

var notify_webhook = function( url, webhookMsg ) {

  request.post({
    url:url,
    form: webhookMsg
  }, function(err,httpResponse,body) {
    if( err ) {
      console.error( "Error attempting to notify " + url + "of new changes to the source data." );
      console.error( pretty(webhookMsg) );

      /// TODO: retry queue?
    }
  });
};

var _inner_do_website = function(sel, website, results, $, html ) {

  var contents = "";

  if( sel === "JSON" ) {
    contents = JSON.parse(html);
  } else {
    var first = $($(sel)[0])
    contents = first && trim(first.text());
  }

  superlog("attempting selector " + sel, results);

  if( !contents ) {
    superlog("...but the selector had no contents..", results);
    return;
  }

  client.hgetall(make_key(website, sel), function(err, cachedObj) {
    if( cachedObj.last_content != contents ) {
      var webhookMsg = Object.assign({}, cachedObj);
      webhookMsg["old_content"] = webhookMsg["last_content"];
      webhookMsg["old_content_fetch_time"] = webhookMsg["last_updated_timestamp"];
      webhookMsg["new_content"] = contents;
      webhookMsg["new_content_fetch_time"] = new Date().getTime();

      delete webhookMsg["last_content"];
      delete webhookMsg["last_checked_timestamp"];
      delete webhookMsg["last_updated_timestamp"];

      /// DO SEND
      notify_webhook( webhookMsg["notify_url"], webhookMsg );

      /// UPDATE MEMBER
      cachedObj["last_checked_timestamp"] = new Date().getTime();
      cachedObj["last_updated_timestamp"] = new Date().getTime();

      if( typeof contents == "object" ) {
        contents = JSON.stringify(contents);
      }
      cachedObj["last_content"] = contents;
      client.hmset(make_key(website, sel), cachedObj);

      superlog("new content found and webhook notified!", results);

    } else {
      cachedObj["last_checked_timestamp"] = new Date().getTime();
      client.hmset(make_key(website, sel), cachedObj);

      superlog("no new content found.  updating timestamp.", results);
    }
  });
}

var do_website = function( website, selector_list ) {

  var results = [];

  request(makeRequest(website), function(error, response, html) {
    if(!error) {

      superlog(website + " successfully fetched.", results);

      var $ = cheerio.load(html);

      for (var i = selector_list.length - 1; i >= 0; i--) {
        _inner_do_website(selector_list[i], website, results, $, html );
      }
    } else {
      superlog("failed to fetch "+website+": " + error, results);
    }
  });

  return results;
};


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
