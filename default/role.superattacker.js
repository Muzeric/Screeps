var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        let healers = _.filter(Game.creeps, c => c.memory.role == "superhealer" && c.memory.attackerID == creep.id).sort();
        let flag = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack').sort()[0];

        if(!flag || creep.room.name != flag.pos.roomName && healers.length < SUPER_HEALER_MINCOUNT) {
            let spawn = Game.spawns[creep.memory.spawnName];
            if (creep.pos.isNearTo(spawn))
                if (creep.hits < creep.hitsMax * 0.95)
                    spawn.renewCreep(creep);
            else 
                creep.moveTo(spawn, {ignoreHostiled: 1});
            
            return;
        }

        let places = utils.getRangedPlaces(null, creep.pos, 1);
        let healersOK = _.sum(healers, c => c.pos.inRangeTo(creep.pos, 1)) >= places.length ? 1 : 0;

        if (creep.room.name != flag.pos.roomName) {
            if (healersOK || creep.pos.isBorder()) {
                if (creep.moveTo(flag, {ignoreHostiled: 1}) == OK) {
                    let dir = creep.memory.newPosDir;
                    for (let i = 0; i < healers.length; i++) {
                        let healer = healers[i];
                        let near = healer.pos.inRangeTo(creep.pos, 1);
                        let res = -1;
                        if (near)
                            res = healer.move(dir);
                        if (!near || res != OK)
                            healers[i].moveTo(creep.pos, {ignoreHostiled: 1, range: 1});
                    }
                }
            } else {
                for (let i = 0; i < healers.length; i++) {
                    let healer = healers[i];
                    healers[i].moveTo(creep.pos, {ignoreHostiled: 1, range: 1});
                }
            }
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
                creep.rangedAttack(target);
                //Memory.targets[creep.room.name] = target.id;
                if (creep.attack(target) == ERR_NOT_IN_RANGE)
                    creep.moveTo(target, {ignoreHostiled: 1});
            } else {
                creep.moveTo(flag, {ignoreHostiled: 1});
            }
            for (let i = 0; i < healers.length; i++) {
                let healer = healers[i];
                healers[i].moveTo(creep.pos, {ignoreHostiled: 1, range: 1});
            }
        }
        
	},
	
    create: function(energy) {
        let body = [];
        body.push(MOVE);
        energy -= 50;
        return [body, energy];
        
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
profiler.registerObject(role, 'roleSuperAttacker');