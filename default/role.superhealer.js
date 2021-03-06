const profiler = require('screeps-profiler');

var role = {

    run: function(creep) {
        let attacker = Game.getObjectById(creep.memory.attackerID);
        if (!attacker) {
            creep.memory.attackerID = null;
            let attackers = _.filter(Game.creeps, c => c.memory.role == 'superattacker' && _.sum(Game.creeps, h => h.memory.role == "superhealer" && h.memory.attackerID == c.id) < SUPER_HEALER_MINCOUNT);
            if (!attackers.length) {
                console.log(creep.name + ": no attackers");
                let spawn = Game.spawns[creep.memory.spawnName];
                if (creep.pos.isNearTo(spawn)) {
                    if (creep.hits < creep.hitsMax * 0.95 && !creep.getBoostedBodyparts()) {
                        spawn.renewCreep(creep);
                        global.cache.skipSpawnNames[spawn.name] = 1;
                    }
                } else {
                    creep.moveTo(spawn, {ignoreHostiled: 1});
                }
                return;
            }
            attacker = attackers.sort((a,b) => a.pos.getRangeTo(creep.pos) - b.pos.getRangeTo(creep.pos))[0];
            creep.memory.attackerID = attacker.id;
        }

        let healed = 0;
        let moved = 0;
        let seeked;
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
            healed = 1;
        }

        //if (!creep.pos.isNearTo(attacker) || creep.pos.isBorder()) {
        
        //if (creep.moveTo(attacker, {ignoreHostiled: 1}) == OK)
        //    moved = 1;

        seeked = creep.pos.findInRange(FIND_MY_CREEPS, 3, {filter: c => c.hits < c.hitsMax})[0];
        if (!healed && seeked) {
            if (creep.pos.isNearTo(seeked)) {
                creep.heal(seeked);
            } else {
                //if (!moved)
                //    creep.moveTo(seeked, {ignoreHostiled: 1});
                creep.rangedHeal(seeked);
            }
        }
	},
	
    create: function(energy) {
        let body = [];
        
        /*
        body.push(MOVE);
        energy -= 50;
        return [body, energy];
        */
        let hnum = global.cache.utils.clamp( Math.floor(energy / 300), 0, 25);
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
profiler.registerObject(role, 'roleSuperHealer');