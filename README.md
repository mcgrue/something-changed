
Testing
========
window.location = "http://localhost:5000/new?url="+encodeURI("https://twitter.com/bengrue")+"&selector="+encodeURI("#stream-items-id > li:nth-child(2) p.js-tweet-text").replace("#", "%23")+"&notify_url="+encodeURI("http://requestb.in/1c97nax1");