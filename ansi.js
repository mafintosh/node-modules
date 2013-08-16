var colors = require('colors');

var inverse = function(str) {
	return str.inverse;
};

module.exports = function(module) {
	var desc = module.description.trim().split(/\s+/).reduce(function(desc, word) {
		if (desc.length-(desc.lastIndexOf('\n')+1) + word.length > 80) return desc+'\n'+word;
		return desc + ' '+word;
	});

	var by = 'by '+(module.related ? inverse(module.author) : module.author)+' and used by ';
	if (module.relation.length) by += module.relation.map(inverse).join(' ')+' and ';
	by += module.dependents+' module'+(module.dependents === 1 ? '' : 's');

	return module.name.bold.cyan+'  '+('★'+module.stars).yellow.bold+'  '+module.url.grey+'  '+ '\n'+by.grey+'\n'+desc+'\n\n';
};

