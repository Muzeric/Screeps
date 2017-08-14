var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (Game.roomsHelper.getHostilesCount(creep.memory.roomName) && creep.checkInRoomAndGo({ignoreHostiled: 1})) {
            if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL))
                creep.heal(creep);
            return;
        }
        
        let mark = {};
        let res = creep.attackNearHostile(50, mark);

        if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) && !mark["attacked"])
            creep.heal(creep);

        if (res != OK) {
            let spawn = Game.spawns[creep.memory.spawnName];
            if (spawn.recycleCreep(creep) == ERR_NOT_IN_RANGE)
                creep.moveTo(spawn, {ignoreHostiled: 1});
        }
	},
	
    create: function(energy, tower) {
        if (!tower)
            energy -= 300; // MOVE,HEAL at end
        let body = [];
        
        let mnum = Math.floor(energy / (50+80));
        if (mnum * 2 + 2 + body.length > 50) // Body parts limit
            mnum = Math.floor((50 - body.length - 2) / 2);
        let anum = mnum;
        while (energy >= 50 && mnum-- > 0) {
            body.push(MOVE);
            energy -= 50;
        }
        while (energy >= 80 && anum-- > 0) {
            body.push(ATTACK);
            energy -= 80;
        }
        if (!tower) {
            body.push(MOVE);
            body.push(HEAL);
        }

        return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleDefender');