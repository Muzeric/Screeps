/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('sourceFinder');
 * mod.thing == 'a thing'; // true
 */

module.exports = {
    findSource : function (creep, spawn, creepsInRoom) {
        //console.log("Searching source for " + creep.name);
        
        let containers = spawn.room.find(FIND_STRUCTURES, { filter: 
            s => s.structureType == STRUCTURE_CONTAINER && 
            _.sum(creepsInRoom, (c) => c.memory.role == "miner" && c.memory.cID == s.id)
        });
        if(containers.length) {
            let cont_info = {};
            for(let container of containers) {
                let cenergy = container.store[RESOURCE_ENERGY];
                let cpath = Math.pow(Math.pow((container.pos.x - creep.pos.x),2) + Math.pow((container.pos.y - creep.pos.y),2), 0.5);
                let cminers = _.sum(creepsInRoom, (c) => c.memory.role == "miner" && c.memory.cID == container.id);
                let cgots = _.sum(creepsInRoom, (c) => c.memory.energyID == container.id);
                //console.log(creep.name + " has container " + container.id + " in " + cpath + " with " + cenergy + " energy and " + cgots + " gots");
                cont_info[container.id] = {cenergy : cenergy, cpath : cpath, cgots : cgots};
            }
            let container = containers.sort( function (a,b) {
                let suma = cont_info[a.id].cpath + (2000 - cont_info[a.id].cenergy + cont_info[a.id].cgots * 200) / 100;
                let sumb = cont_info[b.id].cpath + (2000 - cont_info[b.id].cenergy + cont_info[b.id].cgots * 200) / 100;
                //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
                return suma - sumb;
            })[0];
            
            //console.log(creep.name + " got container " + container.id + " in " + cont_info[container.id].cpath + " with " + cont_info[container.id].cenergy + " energy");
            return container.id;
        }
        
        let sources = spawn.room.find(FIND_SOURCES);
        if(!sources.length) {
            console.log("No sources in room, nothing to do for " + creep.name);
            return;
        }
        let source = sources.sort(function(a,b) { 
            let suma = _.sum(creepsInRoom, (c) => c.memory.energyID == a.id) * (a.id == "577b929c0f9d51615fa46cfc" ? 2 : 1);
            let sumb = _.sum(creepsInRoom, (c) => c.memory.energyID == b.id) * (b.id == "577b929c0f9d51615fa46cfc" ? 2 : 1);
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
        }
        
        if(source.structureType && source.structureType == STRUCTURE_CONTAINER) {
            var res = creep.withdraw(source, RESOURCE_ENERGY);
        } else {
            var res = creep.harvest(source);
        }
        
        if (res== ERR_NOT_IN_RANGE) {
            let res = creep.moveTo(source, { ignoreCreeps : false, costCallback : function(name, cm) { cm.set(4, 43, 255) } });
            //let res = creep.moveTo(source);
            //creep.say("go " + res);
        } else if (res == ERR_NOT_ENOUGH_ENERGY) {
            return;
        } else if (res < 0) {
            console.log(creep.name + " tried to get energy with res = " + res);
            creep.memory.energyID = null;
        }
    }
};