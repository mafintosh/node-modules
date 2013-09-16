(function() {
	var getURL = function(url, retries, callback) {
		var xhr = new XMLHttpRequest();
		var retry = function() {
			getURL(url, retries+1, callback);
		};

		xhr.onreadystatechange = function() {
			if (xhr.readyState !== 4) return;
			if (xhr.status === 0) return setTimeout(retry, retries * 5000);
			if (xhr.status === 200) return callback(null, xhr.responseText);
			callback(new Error('bad request'));
		};

		xhr.open('GET', url);
		xhr.send(null);
	};

	var lastMarker;
	var more = function() {
		if (!document.querySelectorAll) return;
		var modules = document.querySelectorAll('.module');
		if (!modules.length) return;
		var marker = modules[modules.length-1].getAttribute('data-marker');
		if (marker === lastMarker) return;
		lastMarker = marker;

		getURL('/search?q='+window.QUERY+'&u='+window.USERNAME+'&partial=1&marker='+encodeURIComponent(marker), 0, function(err, modules) {
			if (err) return;
			var page = document.createElement('div');
			page.innerHTML = modules;
			document.getElementById('search').appendChild(page);
		});
	};

	window.onscroll = function(e) {
		if (2*window.innerHeight >= document.body.scrollHeight - window.scrollY) more();
	};

	document.getElementById('q').select();
})();