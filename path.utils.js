module.exports = {
    reversePath: reversePath,
    moveToByPatfinderPath: moveToByPatfinderPath
};

function reversePath(path) {
    if (path.path){
        let reverse = Object.assign({}, path);
        reverse.path = reversePathArray(path.path);

        return reverse;
    }
    return reversePathArray(path);
}

function reversePathArray(path){
    return [...path].reverse()
}


function moveToByPatfinderPath(creep, path){
    if(path.path){path = path.path}
    let minRange, minRangeIndex;
    let stepsFromDestination = -1;
    console.log(creep, " using Pathfinder path to move");
    for (let i = path.length - 1; i >=0 ; i--){
        stepsFromDestination++;
        console.log("path: ", JSON.stringify(path))
        let currentSpot = new RoomPosition(path[i].x, path[i].y, path[i].roomName);
        let deltas = getDeltas(creep.pos, currentSpot);
        let rangeToCurrentSpot = getRangeFromDeltas(deltas);
        if (rangeToCurrentSpot === 0 ){return ERR_NOT_FOUND;}
        if (rangeToCurrentSpot === 1){
            return moveOneStep(creep, deltas);
        }
        //let rangeFromDestination = rangeToCurrentSpot + stepsFromEndOfPath;
        if (minRange === undefined || rangeToCurrentSpot < minRange){
            minRange = rangeToCurrentSpot;
            minRangeIndex = i;
        }
    }
    if (minRange === undefined || minRangeIndex === undefined){
        console.log(creep, " can't follow path");
        return ERR_NOT_FOUND;
    }
    if ( minRange > 4){
        console.log(creep, " not close to path given: ", path)
    }
    return creep.moveTo(new RoomPosition(path[minRangeIndex].x, path[minRangeIndex].y, path[minRangeIndex].roomName));
}

function getDeltas(startPos, destPos){
    if(startPos.roomName !== destPos.roomName){return {"x": 100, "y": 100};}
    return {"x": destPos.x - startPos.x, "y": destPos.y - startPos.y}
}
function getRangeFromDeltas(deltas){
    return _.max(Math.abs(deltas.x), Math.abs(deltas.y));
}

function moveOneStep(creep, deltas){
    return creep.move(getDirectionFromDeltas(deltas));

}
function getDirectionFromDeltas(deltas){
    if (deltas.x === 0 && deltas.y < 0){return TOP;}
    if (deltas.x > 0 && deltas.y < 0){return TOP_RIGHT;}
    if (deltas.x > 0 && deltas.y === 0){return RIGHT;}
    if (deltas.x > 0 && deltas.y > 0){return BOTTOM_RIGHT;}
    if (deltas.x === 0 && deltas.y > 0){return BOTTOM;}
    if (deltas.x < 0 && deltas.y > 0){return BOTTOM_LEFT;}
    if (deltas.x < 0 && deltas.y === 0){return LEFT;}
    if (deltas.x < 0 && deltas.y < 0){return TOP_LEFT;}
    return undefined;
}
