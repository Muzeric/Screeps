var utils = require('utils');
var testmode = 1;

var role = {

    run: function(creep) {
        if (creep.hits < creep.hitsMax && (creep.getActiveBodyparts(HEAL) || testmode)) {
            creep.heal(creep);
            if (testmode)
                console.log(creep.name + " healing " + creep.hits + "/" + creep.hitsMax);
        }
	    
        if (creep.room.name != creep.memory.roomName) {
            if (!Game.flags["Antikeeper." + creep.memory.roomName]) {
                console.log(creep.name + " no flag in " + creep.memory.roomName);
                return;
            }
            creep.moveTo(Game.flags["Antikeeper." + creep.memory.roomName]);
            if (testmode)
                console.log(creep.name + " goto " + creep.memory.roomName);
            return;
        }

        let target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if (target) {
            let safePlace = creep.pos.findClosestByPath(getRangedPlaces(target.pos));
            let res = creep.rangedAttack(target);
            if (testmode)
                console.log(creep.name + " attacked " + target.id + " ("+ target.hits +"/" + target.hitsMax + ") res=" + res);
            creep.moveTo(safePlace ? safePlace : target);
        } else {
            let lairs = creep.pos.find(FIND_STRUCTURES, { filter : s => s.structureType == STRUCTURE_KEEPER_LAIR});
            if (!lairs.length) {
                console.log(creep.name + " no lairs in " + creep.room.name);
                return;
            }
            let lair = lairs.sort(function(a,b) {
                return a.ticksToSpawn - b.ticksToSpawn;
            })[0];

            if (creep.pos.getRangeTo(lair) <= 3) {
                creep.moveTo(lair);
                if (testmode)
                    console.log(creep.name + " go to lair " + lair.id);
            } else {
                creep.moveTo(Game.spawns[creep.memory.spawnName]);
                if (testmode)
                    console.log(creep.name + " go to spawn");
            }
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

function getRangedPlaces (pos) {
    let res = [];
    for (let x = -3; x <= 3; x++) {
        for (let y in [-3,3]) {
            res.push(RoomPosition(pos.x + x, pos.y + y, pos.roomName));
        }
    }
    for (let y = -2; y <= 2; y++) {
        for (let x in [-3,3]) {
            res.push(RoomPosition(pos.x + x, pos.y + y, pos.roomName));
        }
    }

    return res;
}