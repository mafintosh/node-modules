var SCORE_FOLLOWING_MAINTAINER = 500;
var SCORE_FOLLOWING_DEPENDENT = 250;
var SCORE_STARRED_MAINTAINER = 200;
var SCORE_STARRED_DEPENDENT = 100;
var SCORE_DEPENDENT = 2;
var SCORE_STAR = 1;

var MAX_STARS_OUTDATED = 1000;

var OUTDATED = 365 * 24 * 3600 * 1000; // 1 year

exports.dependent = function(dep, user) {
	return (user.following[dep] ? 10 : 0) + (user.starred[dep] || 0);
};

exports.module = function(mod, user) {
	var total = 0;
	var gh = mod.github;
	total += mod.dependents.length * SCORE_DEPENDENT;

	if (!gh) return total;

	var stars = gh.stars;
	if (!gh.maintainer) stars = 0;
	if (stars > MAX_STARS_OUTDATED && mod.updated < new Date(Date.now() - OUTDATED)) stars = MAX_STARS_OUTDATED;
	total += stars * SCORE_STAR;

	var following = function(other) {
		return user.following[other];
	};

	gh.dependents.forEach(function(dep) {
		if (following(dep))    total += SCORE_FOLLOWING_DEPENDENT;
		if (user.starred[dep]) total += SCORE_FOLLOWING_DEPENDENT * user.starred[dep];
	});

	var username = gh.username;
	if (!username) return total;

	if (following(username))    total += SCORE_FOLLOWING_MAINTAINER;
	if (user.starred[username]) total += SCORE_STARRED_MAINTAINER * user.starred[username];

	return total;
};
