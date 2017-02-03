var utils = require('utils');
var testmode = 1;

var role = {

    run: function(creep) {
        let targetPos;
        let target;
        if (Memory.attackTargetID) {
            target = Game.getObjectById(Memory.attackTargetID);
        } else {
            let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
            if(flags.length)
                target = flags.sort(function(a,b) {return a.pos.x - b.pos.x;})[0];
        }
        
        if (target)
            targetPos = target.pos;

        let moved = 0;
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        } else {
            let seeked = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => c.hits < c.hitsMax});
            if (seeked) {
                if (creep.heal(seeked) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(seeked);
                    moved = 1;
                }
            }
        }

        if (targetPos && !moved)
            creep.moveTo(targetPos);
	},
	
    create: function(energy) {
        let body = [];

        let hnum = Math.floor(energy / 300);
        energy -= 300 * hnum;
        mnum = hnum * 2;
        
        while (mnum-- > 0)
            body.push(MOVE);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;