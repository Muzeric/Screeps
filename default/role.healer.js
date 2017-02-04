var utils = require('utils');
var testmode = 1;

var role = {

    run: function(creep) {
        let targetPos;

        let healed = 0;
        let seeked;
        let attacker;
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
            healed = 1;
        }

        if (seeked = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax}) ) {
            if (creep.pos.isNearTo(seeked)) {
                if (!healed)
                    creep.heal(seeked);
            } else {
                creep.moveTo(seeked);
                creep.rangedHeal(seeked);
            }
        } else if (attacker = _.filter(Game.creeps, c => c.memory.role == 'attacker').sort()[0] ) {
            creep.moveTo(attacker);
        } else {
            creep.moveTo(Game.spawns[creep.memory.spawnName]);
        }
	},
	
    create: function(energy) {
        let body = [];

        let hnum = Math.floor(energy / 300);
        energy -= 300 * hnum;
        mnum = hnum;
        
        while (mnum-- > 0)
            body.push(MOVE);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;