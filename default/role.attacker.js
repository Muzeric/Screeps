var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        let healer = _.filter(Game.creeps, c => c.memory.role == "healer" && c.memory.attackerID == creep.id)[0];
        let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
	    if(flags.length) {
            let flag = flags.sort()[0];
            if (creep.room.name != flag.pos.roomName) {
                if (healer && creep.pos.getRangeTo(healer) < 3 || creep.pos.isBorder())
                    creep.moveTo(flag, {ignoreHostiled: 1});
                else if (healer)
                    creep.moveTo(healer, {ignoreHostiled: 1});
                return;
            } else {
                let target = 
                    //Game.getObjectById(Memory.targets[creep.room.name]) ||
                    _.filter(flag.pos.lookFor(LOOK_STRUCTURES), s => s.structureType != "road")[0] ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: c => c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK) || c.getActiveBodyparts(HEAL) }) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType != STRUCTURE_CONTROLLER})
                ;
                if (target) {
                    //Memory.targets[creep.room.name] = target.id;
                    if (creep.attack(target) == ERR_NOT_IN_RANGE)
                        creep.moveTo(target, {ignoreHostiled: 1});
                } else {
                    creep.moveTo(flag, {ignoreHostiled: 1});
                }
            }
        } else {
            let spawn = Game.spawns[creep.memory.spawnName];
            if (creep.pos.isNearTo(spawn))
                if (creep.hits < creep.hitsMax * 0.95)
                    spawn.renewCreep(creep);
            else 
                creep.moveTo(spawn, {ignoreHostiled: 1});
        }
        
	},
	
    create: function(energy) {
        let body = [];
        let tnum = 5;
        let mnum = tnum;
        while(tnum-- > 0 && energy >= 10) {
            body.push(TOUGH);
            energy -= 10;
        }
        while(mnum-- > 0 && energy >= 50) {
            body.push(MOVE);
            energy -= 50;
        }
        
        mnum = Math.floor(energy / (50+80));
        if (mnum * 2 + body.length > 50) // Body parts limit
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

        return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleAttacker');