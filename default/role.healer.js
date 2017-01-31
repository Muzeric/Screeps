var utils = require('utils');
var testmode = 1;

var role = {

    run: function(creep) {
        if (!creep.memory.pairCreepID) {
            let creeps = _.filter(Game.creeps, c => c.memory.needHealer && !_.some(Game.creeps, c => c.memory.role == "healer" && c.memory.pairCreepID == c.id && c.ticksToLive > 200));
            if (!creeps.length) {
                console.log(creep.name + " no creep wants healer");
                return;
            }
            creep.memory.pairCreepID = creeps[0].id;
        }

        let pairCreep = Game.getObjectById(creep.memory.pairCreepID);
        if (!pairCreep) {
            console.log(creep.name + " no alive pairCreep");
            return;
        }

        let healObj = null;
        if (pairCreep.hits < pairCreep.hitsMax) {
            healObj = pairCreep;
        } else {
            let creepsForHeal = creep.pos.findInRange(FIND_MY_CREEPS, 5, {filter: c => c.hits < c.hitsMax});
            if (creepsForHeal.length)
                healObj = targets[0];
        }

        if (healObj) {
            console.log(creep.name + " has object for heal ("+ healObj.hits +"/" + healObj.hitsMax + ")");
            if (creep.heal(pairCreep) == ERR_NOT_IN_RANGE)
                    creep.moveTo(pairCreep);
        } else if (!creep.pos.isNearTo(pairCreep)) {
            creep.moveTo(pairCreep);
        }

	},
	
    create: function(energy) {
        let body = [];

        let hnum = 5;
        energy -= 300 * hnum;
        let tnum = Math.floor(energy / 60);
        if (tnum * 2 + hnum * 2 > 50) // Body parts limit
            tnum = Math.floor((50 - hnum * 2) / 2);
        energy -= 60 * tnum;
        mnum = hnum + tnum;
        
        while (tnum-- > 0)
            body.push(TOUGH);
        while (mnum-- > 0)
            body.push(MOVE);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;