const profiler = require('screeps-profiler');

var travel = {
    serializePath: function(path) {
        let poses = '';
        let rooms = '';
        let index = 0;
        let curRoomName;
        for (let p of path) {
            if (curRoomName === undefined || curRoomName != p.roomName) {
                curRoomName = p.roomName;
                rooms += String.fromCharCode(index + 34) + curRoomName + String.fromCharCode(33);
            }
            poses += String.fromCharCode(p.x * 50 + p.y + 34);
            index++;
        }

        return String.fromCharCode(rooms.length + 34 + 1) + rooms + poses;
    },

    getPosFromSerializedPath: function (path, index) {
        let pi = path.charCodeAt(0) - 34;
        if (pi + index >= path.length)
            return null;

        let roomName;
        for (let i = 1; i < pi; i++) {
            let curIndex = path.charCodeAt(i) - 34;
            if (curIndex > index)
                break;
            let end = path.indexOf(String.fromCharCode(33), i+1);
            roomName = path.substring(i+1, end);
            i = end;
        }

        if (!roomName)
            return null;

        let code = path.charCodeAt(pi + index) - 34;
        let x = _.floor(code / 50);
        let y = code - x * 50;
        return new RoomPosition(x, y, roomName);
    },

    getSubFromSerializedPath: function (path, limit, start = 0) {
        let pi = path.charCodeAt(0) - 34;
        if (pi + start >= path.length)
            return null;

        let ret = [];
        let j = pi;
        for (let i = 2; i < pi; i++) {
            let end = path.indexOf(String.fromCharCode(33), i+1);
            let roomName = path.substring(i, end);
            i = end+1;
            let endJ;
            if (i == pi)
                endJ = path.length;
            else
                endJ = path.charCodeAt(i) - 34 + pi;
            for (; j < endJ; j++) {
                if (j - pi < start)
                    continue;
                let code = path.charCodeAt(j) - 34;
                let x = _.floor(code / 50);
                let y = code - x * 50;
                ret.push(new RoomPosition(x, y, roomName));
                if (limit && ret.length >= limit)
                    return ret;
            }
        }

        return ret;
    },

    getIterFromSerializedPath: function (path, pos, start = 0) {
        let pi = path.charCodeAt(0) - 34;
        if (pi + start >= path.length)
            return null;
        
        let posCode = String.fromCharCode(pos.x * 50 + pos.y + 34);

        let j = pi + start;
        for (let i = 2; i < pi; i++) {
            let roomEnd = path.indexOf(String.fromCharCode(33), i+1);
            let roomName = path.substring(i, roomEnd);
            i = roomEnd+1;
            let limitJ;
            if (i == pi)
                limitJ = path.length;
            else
                limitJ = path.charCodeAt(i) - 34 + pi;
            if (roomName != pos.roomName) {
                if (limitJ > j)
                    j = limitJ;
                continue;
            }
            for (; j < limitJ; j++) {
                if (posCode == path.charAt(j))
                    return j - pi;
            }
        }

        return null;
    },

    getLengthOfSerializedPath: function (path) {
        let pi = path.charCodeAt(0) - 34;
        return path.length - pi;
    },

    getPath: function(sourcePos, targetPos, targetKey = null, addCreeps, pathCache, limit = PATH_OPS_LIMIT_LONG, ignoreHostiled) {
        let sourceKey = sourcePos.getKey();
        if (!Array.isArray(targetPos) && targetKey !== null) {
            if (pathCache[targetKey] && pathCache[targetKey][sourceKey]) {
                pathCache[targetKey][sourceKey].useTime = Game.time;
                pathCache[targetKey][sourceKey].useCount = (pathCache[targetKey][sourceKey].useCount || 0) + 1
                return { path: pathCache[targetKey][sourceKey].path, serialized: 1 };
            }
        }

        return PathFinder.search(
            sourcePos,
            targetPos,
            {
                plainCost: 2,
                swampCost: 10,
                maxOps: limit,
                roomCallback: function(roomName) { 
                    if (!(roomName in Memory.rooms) || (Memory.rooms[roomName].type == 'hostiled' && !ignoreHostiled) || !global.cache.matrix[roomName])
                        return false;
                    
                    if (addCreeps)
                        return global.cache.matrix[roomName]["withCreeps"];
                    return global.cache.matrix[roomName]["common"];
                },
            }
        );
    },

    setPath: function(mem, path, sourceKey, targetKey, pathCache, incomplete) {
        mem.path = path;
        mem.length = this.getLengthOfSerializedPath(path);
        mem.iter = 0;
        mem.here = 0;
        mem.sourceKey = sourceKey;
        mem.targetKey = targetKey || this.getPosFromSerializedPath(path, mem.length-1).getKey(1);
        mem.incomplete = incomplete ? 1 : 0;

        if (pathCache) {
            pathCache[mem.targetKey] = pathCache[mem.targetKey] || {};
            if (!(sourceKey in pathCache[mem.targetKey]))
                pathCache[mem.targetKey][sourceKey] = {path: mem.path, useTime: Game.time, createTime: Game.time, useCount: 0};
        }
    },

    getRoomsAvgPathLength: function (pathCache, roomName) {
        length = 0;
        count = 0;
        for (let key in pathCache) {
            //45x44W46N4
            let regex = /^\d+x\d+(\w\d+\w\d+)$/;
            let match = regex.exec(key);
            if (match[1] != roomName) 
                continue;
            for (let cr in pathCache[key]) {
                if (!pathCache[key][cr].useCount)
                    continue;
                count++;
                length += this.getLengthOfSerializedPath(pathCache[key][cr].path);
            }
        }

        return count ? _.parseInt(length / count) : null;
    },

    clearPathCache: function (pathCache) {
        let allCount = 0;
        let delCount = 0;
        for (let target in pathCache) {
            for (let source in pathCache[target]) {
                allCount++;
                if (
                    Game.time - pathCache[target][source].useTime > PATHCACHE_USE_TIMEOUT || 
                    Game.time - pathCache[target][source].createTime > PATHCACHE_CREATE_TIMEOUT ||
                    !pathCache[target][source].useCount && Game.time - pathCache[target][source].useTime > PATHCACHE_USE_TIMEOUT/3
                ) {
                    delete pathCache[target][source];
                    delCount++;
                }
            }
            if (!_.keys(pathCache[target]).length)
                delete pathCache[target];
        }

        return allCount - delCount;
    },
};

module.exports = travel;
profiler.registerObject(travel, 'travel');