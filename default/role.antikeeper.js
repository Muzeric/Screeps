var utils = require('utils');

var role = {

    run: function(creep) {
        if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL))
            creep.heal(creep);
	    
        if (creep.room.name != creep.memory.roomName) {
            if (!Game.flags["Antikeeper." + creep.memory.roomName]) {
                console.log(creep.name + " no flag in " + creep.memory.roomName);
                return;
            }
            creep.moveTo(Game.flags["Antikeeper." + creep.memory.roomName]);
            return;
        }

        let target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if (target) {
            let safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(target.pos, 3));
            let hitsBefore = target.hits;
            let res = creep.rangedAttack(target);
            //console.log(creep.name + " attacked " + target.id + " ("+ hitsBefore + "->" + target.hits +"/" + target.hitsMax + ") res=" + res);
            creep.moveTo(safePlace ? safePlace : target);
            //console.log(creep.name + " go to " + (safePlace ? safePlace : target).pos.x + "," + (safePlace ? safePlace : target).pos.y);
        } else {
            let lairs = creep.room.find(FIND_STRUCTURES, { filter : s => s.structureType == STRUCTURE_KEEPER_LAIR});
            if (!lairs.length) {
                console.log(creep.name + " no lairs in " + creep.room.name);
                return;
            }
            let lair = lairs.sort(function(a,b) {
                return a.ticksToSpawn - b.ticksToSpawn;
            })[0];

            if (creep.pos.getRangeTo(lair) > 3) {
                creep.moveTo(lair);
                //console.log(creep.name + " go to lair " + lair.id);
            }
        }

	},
	
    create: function(energy) {
        let anum = 20;
        let hnum = 5;
        let mnum = anum + hnum;
        energy -= 150 * anum + 50 * mnum + 250 * hnum;
        
        while (mnum-- > 0)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(RANGED_ATTACK);
        body.push(HEAL, HEAL);
        
        return [body, energy];
	},
};

module.exports = role;