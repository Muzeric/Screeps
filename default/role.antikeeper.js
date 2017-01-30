var utils = require('utils');
var testmode = 1;

var role = {

    run: function(creep) {   
        if (creep.room.name != creep.memory.roomName) {
            if (!Game.flags["Antikeeper." + creep.memory.roomName]) {
                console.log(creep.name + " no flag in " + creep.memory.roomName);
                return;
            }
            creep.moveTo(Game.flags["Antikeeper." + creep.memory.roomName]);
            return;
        }

        let targets = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
        if (targets.length) {
            let target = targets[0];
            if (creep.attack(target) == ERR_NOT_IN_RANGE)
                creep.moveTo(target);
            if (testmode)
                console.log(creep.name + " attacked " + target.id + " ("+ target.hits +"/" + target.hitsMax + ")");
        } else {
            if (creep.hits < creep.hitsMax && (creep.getActiveBodyparts(HEAL) || testmode)) {
                creep.heal(creep);
                if (testmode)
                    console.log(creep.name + " healing " + creep.hits + "/" + creep.hitsMax);
                return;
            }
            let lair = Game.getObjectById(creep.memory.lairID);
            if(!lair) {
                lair = creep.pos.findClosestByPath(FIND_STRUCTURES, { filter : s => 
                    s.structureType == STRUCTURE_KEEPER_LAIR &&
                    !_.some(Game.creeps, {filter: c => c.memory.role == "antikeeper" && c.memory.lairID == s.id} ) 
                });
                if (!lair) {
                    console.log(creep.name + " no lairs in " + creep.room.name);
                    return;
                }
                creep.memory.lairID = lair.id;
            }

            if(!creep.pos.isNearTo(lair))
                creep.moveTo(lair);
        }

	},
	
    create: function(energy) {
        //10 × 2 + 50 + 150 × 11 + 250 + 50 × 6
        if (testmode) {
            return [[TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE], energy - 180];
        }

        let anum = 11;
        let fat = anum + 1;
        energy -= 150 * anum; // ranged_attack
        energy -= 250; // heal

        let body = [];
        let mnum = Math.ceil(fat / 2);
        fat -= mnum * 2;
        energy -= 50 * mnum;
        let tnum = Math.floor(energy / 70);
        energy -= 70 * tnum;

        while (tnum-- > 0)
            body.push(TOUGH, TOUGH, MOVE);
        while (mnum-- > 0)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(RANGED_ATTACK);
        body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;