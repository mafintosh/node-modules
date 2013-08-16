(function() {
	var states = ['.','..','...',''];
	var interval = setInterval(function() {
		states.push(states.shift());
		document.getElementById('progress').innerHTML = states[states.length-1];
	}, 500);

	var opt = function(name) {
		return (location.search.split(name+'=')[1] || '').split('&')[0];
	};

	var then = new Date();

	var addClass = function(el, name) {
		el.className = el.className.replace(name, '') + ' '+name;
	};

	var removeClass = function(el, name) {
		el.className = el.className.replace(name, '');
	};

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

	var onprogressend = function(winner) {
		document.getElementById('progress').innerHTML = '';
		clearInterval(interval);
		addClass(document.getElementById('index-progress'), 'hidden');
		removeClass(document.getElementById('index-'+winner), 'hidden');
	};

	var onindexerror = function() {
		document.cookie = 'username=; Expires=Mon, 01 Jan 1990 00:00:00 GMT';
		document.getElementById('u').value = '';
		getURL('/search?partial=1&force=1&q='+opt('q')+'&u=&limit='+opt('limit'), 0, function(err, modules) {
			onprogressend('error');
			document.getElementById('search').innerHTML = modules || '';
		});
	};

	getURL('/search?partial=1&force=1&q='+opt('q')+'&u='+opt('u')+'&limit='+opt('limit'), 0, function(err, modules) {
		if (err) return onindexerror();
		onprogressend('complete');
		document.getElementById('search').innerHTML = modules;
		document.getElementById('time').innerHTML = Math.round((new Date().getTime() - then.getTime()) / 100) / 10;
	});
})();