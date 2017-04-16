var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {

    run: function(creep) {
        let attacker = Game.getObjectById(creep.memory.attackerID);
        if (!attacker) {
            creep.memory.attackerID = null;
            let attackers = _.filter(Game.creeps, c => c.memory.role == 'attacker' && !_.some(Game.creeps, h => h.memory.role == "healer" && h.memory.attackerID == c.id));
            if (!attackers.length) {
                console.log(creep.name + ": no attackers");
                let spawn = Game.spawns[creep.memory.spawnName];
                if (creep.pos.isNearTo(spawn))
                    if (creep.hits < creep.hitsMax * 0.95)
                        spawn.renewCreep(creep);
                else
                    creep.moveTo(spawn, {ignoreHostiled: 1});
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

        if (!creep.pos.isNearTo(attacker) || creep.pos.isBorder()) {
            creep.moveTo(attacker, {ignoreHostiled: 1});
            moved = 1;
        }

        seeked = creep.pos.findInRange(FIND_MY_CREEPS, 3, {filter: c => c.hits < c.hitsMax})[0];
        if (!healed && seeked) {
            if (creep.pos.isNearTo(seeked)) {
                creep.heal(seeked);
            } else {
                if (!moved)
                    creep.moveTo(seeked, {ignoreHostiled: 1});
                creep.rangedHeal(seeked);
            }
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
profiler.registerObject(role, 'roleHealer');