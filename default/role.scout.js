var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        return;
	},
	
    create: function(energy) {
        let body = [];
        if(energy >= 50) {
            body.push(MOVE);
	        energy -= 50;
	    }

	    return [body, energy];
	}
};

module.exports = role;
profiler.registerObject(role, 'roleScout');