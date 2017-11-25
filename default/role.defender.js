const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        /*
        if (Game.roomsHelper.getHostilesCount(creep.memory.roomName) && creep.checkInRoomAndGo({ignoreHostiled: 1})) {
            if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL))
                creep.heal(creep);
            return;
        }
        */
        
        let hostiles = global.cache.hostiles[creep.memory.roomName];
        if (hostiles && "attackers" in hostiles && hostiles.attackers.length && creep.room.name != creep.memory.roomName) {
            creep.moveTo(hostiles.attackers[0]);
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
	
    create: function(energy, tower = 0) {
        if (!tower)
            energy -= 300; // MOVE,HEAL at end
        let body = [];
        
        let tnum = 0;
        let mnum = 0;
        let anum = 0;
        let rnum = 0;
        if (energy < 3000) {
            mnum = global.cache.utils.clamp(Math.floor(energy / (50+80)), 0, 24 + tower);
            anum = mnum;
        } else {
            tnum = tower ? 0 : 4;
            mnum = global.cache.utils.clamp(Math.floor((energy - 10 * tnum) / (50+80 + 50+150) * 2) + tnum, 0, 24 + tower);
            anum = Math.floor((mnum - tnum) / 2);
            rnum = Math.floor((mnum - tnum) / 2);
        }
        energy -= 10 * tnum + 80 * anum + 150 * rnum + 50 * mnum;

        while (tnum-- > 0)
            body.push(TOUGH);
        while (mnum-- > 0)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(ATTACK);
        while (rnum-- > 0)
            body.push(RANGED_ATTACK);
        
        if (!tower) {
            body.push(MOVE);
            body.push(HEAL);
        }

        return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleDefender');