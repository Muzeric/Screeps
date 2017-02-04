var utils = require('utils');
var testmode = 1;

var role = {

    run: function(creep) {
        let targetPos;

        let moved = 0;
        let seeked;
        let flag;
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        } else if (seeked = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax}) ) {
            if (creep.heal(seeked) == ERR_NOT_IN_RANGE)
                creep.moveTo(seeked);
        } else if (flag = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack').sort()[0] ) {
            if (creep.room.name != flag.pos.roomName) {
                creep.moveTo(flag);
            } else {
                let target = creep.pos.findClosestByPath(FIND_MY_CREEPS);
                if (target)
                    creep.moveTo(target);
            }
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