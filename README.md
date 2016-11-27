[![CircleCI](https://circleci.com/gh/mcgrue/something-changed.svg?style=svg)](https://circleci.com/gh/mcgrue/something-changed)

Something Changed!
========
The microest of services; Add a url and a website selector

ToDo
========
* json-path semantics as well as css selectors for checking if a json endpoint changed?
* allowing for the nth node of a selector type has changed, instead of the first one?
* http-get failure retry queue?
* webhook-send failure retry queue?
* asyncification of logging?
* mulitple webhook endpoints for a single url/selector pair?

Testing
========
window.location = "http://localhost:5000/new?url="+encodeURI("https://twitter.com/bengrue")+"&selector="+encodeURI("#stream-items-id > li:nth-child(2) p.js-tweet-text").replace("#", "%23")+"&notify_url="+encodeURI("http://requestb.in/1c97nax1");

window.location = "http://localhost:5000/check?url="+encodeURI("https://twitter.com/bengrue")+"&selector="+encodeURI("#stream-items-id > li:nth-child(2) p.js-tweet-text").replace("#", "%23")+"&notify_url="+encodeURI("http://requestb.in/1c97nax1");


window.location = "http://localhost:5000/new?url="+encodeURI("http://verge-rpg.com")+"&selector="+encodeURI(".newest_thread").replace("#", "%23")+"&notify_url="+encodeURI("http://requestb.in/1c97nax1");

window.location = "http://localhost:5000/new?url="+encodeURI("https://twitter.com/bengrue")+"&selector="+encodeURI(".ProfileNav-item--followers > a").replace("#", "%23")+"&notify_url="+encodeURI("http://requestb.in/1c97nax1");

http://localhost:5000/new?url=https://feeds.drafthouse.com/adcService/showtimes.svc/market/0800/&json=true&notify_url=http://requestb.in/1c97nax1