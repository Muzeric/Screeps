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
        let resource = creep.pos.findClosestByPath(FIND_DROPPED_ENERGY, { filter: r => r.amount > 100 });
        if(resource) {
            console.log(creep.name + " found dropped resource: " + resource.id + " with " + resource.amount + " energy");
            return resource.id;
        }
        
        let containers = creep.room.find(FIND_STRUCTURES, { filter: 
            s =>
            (
                s.structureType == STRUCTURE_CONTAINER && 
                _.sum(Game.creeps, (c) => (c.memory.role == "miner" || c.memory.role == "longminer") && c.memory.cID == s.id)
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
                let wantEnergy = _.reduce(_.filter(Game.creeps, c => c.memory.energyID == container.id), function (sum, value) { return sum + value.carryCapacity; }, 0);
                let cpriority = storage_priority && container.structureType == STRUCTURE_STORAGE || !storage_priority && container.structureType == STRUCTURE_CONTAINER ? 1 : 0;
                let cenergyTicks = (wantEnergy + creep.carryCapacity - cenergy) / 10;
                if (cenergyTicks < 0)
                    cenergyTicks = 0;
                cont_info[container.id] = cpath * 1.2 + cenergyTicks - 100 * cpriority;
                //console.log(creep.name + " [" + creep.memory.spawnName + "] has container " + container.id + " in " + cpath + " with " + cenergy + " energy and " + wantEnergy + " wanted and cpriotiy=" + cpriority + " sum=" + cont_info[container.id]);
            }
            let container = containers.sort( function (a,b) {
                let suma = cont_info[a.id];
                let sumb = cont_info[b.id];
                //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
                return suma - sumb;
            })[0];
            
            //console.log(creep.name + " got container " + container.id + " in " + cont_info[container.id].cpath + " with " + cont_info[container.id].cenergy + " energy");
            return container.id;
        }
        
        let sources = creep.room.find(FIND_SOURCES);
        if(!sources.length) {
            console.log(creep.name + " no sources in room, nothing to do");
            return;
        }
        let source = sources.sort(function(a,b) { 
            let suma = _.sum(Game.creeps, (c) => c.memory.energyID == a.id) * (a.id == "577b929c0f9d51615fa46cfc" ? 2 : 1);
            let sumb = _.sum(Game.creeps, (c) => c.memory.energyID == b.id) * (b.id == "577b929c0f9d51615fa46cfc" ? 2 : 1);
            return suma - sumb;
        })[0];
        //console.log("Source for " + creep.name + " is " + source.id);
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
            !_.sum(Game.creeps, (c) => (c.memory.role == "miner" || c.memory.role == "longminer") && c.memory.cID == source.id)
        ) {
            //console.log(creep.name + " has source=container without miners");
            creep.memory.energyID = null;
            return;
        /*
        } else if (
            source.structureType &&
            source.structureType == STRUCTURE_CONTAINER &&
            source.store[RESOURCE_ENERGY] < creep.carryCapacity
        ) {
            console.log(creep.name + " has source=container without energy");
            creep.memory.energyID = null;
            return;
        */
        } else if (
            source.structureType &&
            source.structureType == STRUCTURE_STORAGE &&
            source.store[RESOURCE_ENERGY] < creep.carryCapacity
        ) {
            //console.log(creep.name + " has source=storage without enough energy");
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
            if(!creep.getActiveBodyparts(ATTACK)) {
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
                let res = creep.moveTo(target, {ignoreDestructibleStructures : (creep.room.controller.my ? false : true)});
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

        let targets = Array();
        for(let buildf of builds) {  
            if(_.some(buildf.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER})))
                continue;
            let repairLimit = roomConfig[buildf.pos.roomName] ? roomConfig[buildf.pos.roomName].repairLimit : 250000;
            targets = targets.concat( buildf.room.find(FIND_STRUCTURES, { filter: (structure) => 
                structure.hits < structure.hitsMax*0.9 &&
                structure.hits < repairLimit &&
                !_.some(Game.creeps, c => c.memory.role == "longbuilder" && c.memory.targetID == structure.id) 
            } ) );
        }
        
        if(targets.length) {
                var rt = targets.sort(function (a,b) { 
                    let suma = (a.hits*100/a.hitsMax < 25 ? -1000 : a.hits*100/a.hitsMax) + (creep && creep.room.name == a.room.name ? -30 : 30) + (creep ? creep.pos.getRangeTo(a) : 0);
                    let sumb = (b.hits*100/b.hitsMax < 25 ? -1000 : b.hits*100/b.hitsMax) + (creep && creep.room.name == b.room.name ? -30 : 30) + (creep ? creep.pos.getRangeTo(b) : 0);
                    return (suma - sumb) || (a.hits - b.hits); 
                })[0];
                return rt.id;
        }
        
        return null;
    },

    test : function (total_energy) {
        let inEnergy = total_energy;

        total_energy -= 50;
        let body = [CARRY];
        let wlim = 5;
        let fat = 1;
        let mnum = 0;
        while (total_energy >= 100 && wlim) {
            if (total_energy >= 100) {
	            body.push(WORK);
	            wlim--;
                fat++;
	            total_energy -= 100;
	        }
            if ((!mnum || fat/(mnum*2) >= 2) && total_energy >= 50) {
                body.push(MOVE);
	            total_energy -= 50;
                mnum++;
            }
        }

        console.log((inEnergy - total_energy) + ": " + body);
    },
};