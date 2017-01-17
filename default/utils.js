var roomConfig = {
    "W48N4" : {
        "repairLimit" : 1000000,
    },
    "W49N4" : {
        "repairLimit" : 135000,
    },
};

module.exports = {
    roomConfig : roomConfig,

    findSource : function (creep, storage_priority) {
        //console.log("Searching source for " + creep.name);
        let resource = creep.pos.findClosestByPath(FIND_DROPPED_ENERGY, { filter: r => r.amount > 100 });
        if(resource) {
            console.log(creep.name + " found dropped resource: " + resource.id + " with " + resource.amount + " energy");
            return resource.id;
        }
        
        let containers = creep.room.find(FIND_STRUCTURES, { filter: 
            s =>
            (
                s.structureType == STRUCTURE_CONTAINER && 
                _.sum(Game.creeps, (c) => c.memory.role == "miner" && c.memory.cID == s.id)
            ) ||
            (
                s.structureType == STRUCTURE_STORAGE && 
                s.store[RESOURCE_ENERGY] > creep.carryCapacity
            )
        });
        if(containers.length) {
            let cont_info = {};
            for(let container of containers) {
                let cenergy = container.store[RESOURCE_ENERGY];
                let cpath = creep.pos.getRangeTo(container);
                let cminers = _.sum(Game.creeps, (c) => c.memory.role == "miner" && c.memory.cID == container.id);
                let cgots = _.sum(Game.creeps, (c) => c.memory.energyID == container.id);
                let cpriority = container.structureType == STRUCTURE_STORAGE && storage_priority || container.structureType == STRUCTURE_CONTAINER && cenergy * 1.5 > creep.carryCapacity ? 1 : 0;
                //console.log(creep.name + " has container " + container.id + " in " + cpath + " with " + cenergy + " energy and " + cgots + " gots and sum=" + (cpath + (2000 - cenergy + cgots * 200) / 100 - 10000 * cpriority));
                cont_info[container.id] = {cenergy : cenergy, cpath : cpath, cgots : cgots, cpriority : cpriority};
            }
            let container = containers.sort( function (a,b) {
                let suma = cont_info[a.id].cpath + (2000 - cont_info[a.id].cenergy + cont_info[a.id].cgots * 200) / 100 - 10000 * cont_info[a.id].cpriority;
                let sumb = cont_info[b.id].cpath + (2000 - cont_info[b.id].cenergy + cont_info[b.id].cgots * 200) / 100 - 10000 * cont_info[b.id].cpriority;
                //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
                return suma - sumb;
            })[0];
            
            //console.log(creep.name + " got container " + container.id + " in " + cont_info[container.id].cpath + " with " + cont_info[container.id].cenergy + " energy");
            return container.id;
        }
        
        let sources = creep.room.find(FIND_SOURCES);
        if(!sources.length) {
            console.log("No sources in room, nothing to do for " + creep.name);
            return;
        }
        let source = sources.sort(function(a,b) { 
            let suma = _.sum(Game.creeps, (c) => c.memory.energyID == a.id) * (a.id == "577b929c0f9d51615fa46cfc" ? 2 : 1);
            let sumb = _.sum(Game.creeps, (c) => c.memory.energyID == b.id) * (b.id == "577b929c0f9d51615fa46cfc" ? 2 : 1);
            return suma - sumb;
        })[0];
        console.log("Source for " + creep.name + " is " + source.id);
        return source.id;
    },
    
    gotoSource : function(creep) {
        let source = Game.getObjectById(creep.memory.energyID);
        if(!source) {
            console.log(creep.name + " can't get source with enegryID=" + creep.memory.energyID);
            creep.memory.energyID = null;
            return;
        } else if (
            source.structureType &&
            source.structureType == STRUCTURE_CONTAINER &&
            !_.sum(Game.creeps, (c) => c.memory.role == "miner" && c.memory.cID == source.id)
        ) {
            console.log(creep.name + " has source=container without miners");
            creep.memory.energyID = null;
            return;
        } else if (
            source.structureType &&
            source.structureType == STRUCTURE_STORAGE &&
            source.store[RESOURCE_ENERGY] < creep.carryCapacity
        ) {
            console.log(creep.name + " has source=storage without enough energy");
            creep.memory.energyID = null;
            return;
        }
        
        if(source.structureType && (source.structureType == STRUCTURE_CONTAINER || source.structureType == STRUCTURE_STORAGE || source.structureType == STRUCTURE_LINK)) {
            var res = creep.withdraw(source, RESOURCE_ENERGY);
        } else if (source.resourceType && source.resourceType == RESOURCE_ENERGY) {
            var res = creep.pickup(source);
            if (!res) {
                console.log(creep.name + " picked up resource");
                creep.memory.energyID = null;
                return;
            }
        } else {
            var res = creep.harvest(source);
        }
        
        if (res == ERR_NOT_IN_RANGE) {
            let res = creep.moveTo(source, { costCallback : function(name, cm) { cm.set(4, 43, 255); cm.set(4, 42, 255); cm.set(4, 41, 255); } });
            //let res = creep.moveTo(source);
            //creep.say("go " + res);
        } else if (res == ERR_NOT_ENOUGH_ENERGY) {
            return;
        } else if (res < 0) {
            console.log(creep.name + " tried to get energy with res = " + res);
            creep.memory.energyID = null;
        }
    },
    
    try_attack : function (creep, all) {
        let target;
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {ignoreDestructibleStructures : true, filter : s => s.structureType == STRUCTURE_TOWER});
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS, {ignoreDestructibleStructures : true});
        if(!target)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {ignoreDestructibleStructures : true});
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {ignoreDestructibleStructures : true, filter : s => s.structureType != STRUCTURE_CONTROLLER});
        /*
        if(!target && creep.memory.targetID && Game.getObjectById(creep.memory.targetID))
            target = Game.getObjectById(creep.memory.targetID);
        let con_creep = _.filter(Game.creeps, c => c.memory.role == "attacker" && c.room == creep.room && c.memory.targetID && c != creep)[0];
        if(con_creep && (!creep.memory.targetID || creep.memory.targetID!=con_creep.memory.targetID) && Game.getObjectById(con_creep.memory.targetID)) {
            target = Game.getObjectById(con_creep.memory.targetID);
            console.log(creep.name + " found con_creep " + con_creep.name + " with target=" + con_creep.memory.targetID);
        }
        */
        if(target) {
            creep.memory.targetID = target.id;
            if(!_.some(creep.body, b => b.type == ATTACK && b.hits > 50)) {
                console.log(creep.name + " has no ATTACK parts, but hostile in room, go away");
                return 0;
            }
            if (Game.time % 10 == 0)
            console.log(creep.name +
            " attacks: owner=" + (target.owner ? target.owner.username : 'no owner') +
            "; ticksToLive=" + target.ticksToLive +
            "; hits=" + target.hits + 
            "; structureType=" + target.structureType
            );
            let res = creep.attack(target);
            if(res == ERR_NOT_IN_RANGE) {
                let res = creep.moveTo(target, {ignoreDestructibleStructures : true});
                //let res = creep.moveTo(target);
                if(res < 0) {
                    //console.log(creep.name + " moved in attack with res=" + res);
                }
            } else if (res < 0) {
                console.log(creep.name + " attacked with res=" + res);
            }
            return 1;
        }
    	return -1;
    },
    
    getLongBuilderTargets: function (creep) {
        let builds = _.filter(Game.flags, f => f.name.substring(0, 5) == 'Build' && Game.rooms[f.pos.roomName]);
        for(let buildf of builds) {
            let object = buildf;
            if (creep && creep.room.name == buildf.room.name)
                object = creep;
                
            let target = object.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES);
            if(target)
                return target.id;
        }

        for(let buildf of builds) {  
            if(_.some(buildf.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER})))
                continue;
            let repairLimit = roomConfig[buildf.pos.roomName] ? roomConfig[buildf.pos.roomName].repairLimit : 100000;
            var targets = buildf.room.find(FIND_STRUCTURES, { filter: (structure) => structure.hits < structure.hitsMax*0.9 && structure.hits < repairLimit } );
            if(targets.length) {
                var rand = Math.floor(Math.random() * 3) % targets.length;
                var rt = targets.sort(function (a,b) { return (a.hits - b.hits) || (a.hits/a.hitsMax - b.hits/b.hitsMax); })[rand];
                return rt.id;
            }
        }
        
        return null;
    },
};