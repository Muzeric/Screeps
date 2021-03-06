const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        let healerMinCount = "healerMinCount" in creep.memory ? creep.memory.healerMinCount : SUPER_HEALER_MINCOUNT;

        let healers = _.filter(Game.creeps, c => c.memory.role == "superhealer" && c.memory.attackerID == creep.id).sort();
        let flag = _.filter(Game.flags, f => creep.memory.flagName ? f.name == creep.memory.flagName : f.name.substring(0, 6) == 'Attack').sort()[0];

        if(!flag || creep.room.name != flag.pos.roomName && healers.length < healerMinCount) {
            let spawn = Game.spawns[creep.memory.spawnName];
            if (creep.pos.isNearTo(spawn)) {
                if (creep.ticksToLive < 1450 && !creep.getBoostedBodyparts()) {
                    spawn.renewCreep(creep);
                    global.cache.skipSpawnNames[spawn.name] = 1;
                }
            } else {
                creep.moveTo(spawn, {ignoreHostiled: 1});
            }
            for (let i = 0; i < healers.length; i++) {
                let healer = healers[i];
                healer.moveTo(spawn, {ignoreHostiled: 1});
                if (healer.ticksToLive < 1450 && !healer.getBoostedBodyparts()) {
                    spawn.renewCreep(healer);
                    global.cache.skipSpawnNames[spawn.name] = 1;
                }
            }
            
            return;
        }

        let places = global.cache.utils.getRangedPlaces(null, creep.pos, 1);
        let healersOK = _.sum(healers, c => c.pos.inRangeTo(creep.pos, 3)) >= _.min([places.length, healers.length, healerMinCount]) ? 1 : 0;
        let healersBorder = _.sum(healers, c => c.pos.isBorder());

        if (creep.room.name != flag.pos.roomName) {
            if (healersOK || creep.pos.isBorder() || healersBorder) {
                if (creep.moveTo(flag, {ignoreHostiled: 1}) == OK) {
                    let dir = creep.memory.newPosDir;
                    for (let i = 0; i < healers.length; i++) {
                        let healer = healers[i];
                        let near = healer.pos.inRangeTo(creep.pos, 1);
                        let res = -1;
                        if (near)
                            res = healer.move(dir);
                        if (!near || res != OK)
                            healer.moveTo(creep.pos, {ignoreHostiled: 1, range: 1});
                    }
                }
            } else {
                for (let i = 0; i < healers.length; i++) {
                    let healer = healers[i];
                    healer.moveTo(creep.pos, {ignoreHostiled: 1, range: 1});
                }
            }
            return;
        } else {
            let target = 
                //Game.getObjectById(Memory.targets[creep.room.name]) ||
                _.filter(flag.pos.lookFor(LOOK_STRUCTURES), s => s.structureType != "road")[0] ||
                creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: c => c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK) || c.getActiveBodyparts(HEAL) || c.hits < c.hitsMax}) ||
                creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}) ||
                creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS) ||
                creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType != STRUCTURE_CONTROLLER}) ||
                creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS) ||
                creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES)
            ;
            if (target && "progress" in target) {
                creep.moveTo(target, {ignoreHostiled: 1});
            } else if (target) {
                creep.rangedAttack(target);
                //Memory.targets[creep.room.name] = target.id;
                if (creep.attack(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {ignoreHostiled: 1, range: "body" in target ? 3 : 1});
                }
            } else {
                creep.moveTo(flag, {ignoreHostiled: 1});
            }
            for (let i = 0; i < healers.length; i++) {
                let healer = healers[i];
                healer.moveTo(creep.pos, {ignoreHostiled: 1, range: 1});
            }
        }
        
	},
	
    create: function(energy) {
        /*
        let body = [];
        body.push(MOVE);
        energy -= 50;
        return [body, energy];
        */
        // 10 * 6 + 80 * 8 + 150 * 7 + 50 * (6+8+7) / 2 = 2280

        // 10 * 6 + 150 * 20 + 250 * 3 + 50 * 15 = 4560
        // 10 * 6 + 80 * 22  + 250 * 5 + 50 * 17 = 3920
        let tnum = 6;
        let anum = 8;
        let rnum = 7;
        let mnum = tnum + anum + rnum;
        energy -= 10 * tnum + 80 * anum + 150 * rnum + 50 * mnum;
        
        let body = [];
        
        while (tnum-- > 0)
            body.push(TOUGH);
        while (mnum-- > 1)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(ATTACK);
        while (rnum-- > 0)
            body.push(RANGED_ATTACK);
        while (mnum-- > -1)
            body.push(MOVE);
        
        return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleSuperAttacker');