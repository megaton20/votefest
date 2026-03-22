
// audio notiation
let fadeOutInterval = null;
const stopSound = document.getElementById("stopSound");

const soundElements = {
"error": document.getElementById("errorSound"),
"happy": document.getElementById("happySound"),
"warning": document.getElementById("warningSound"),
"pop": document.getElementById("popSound"),
};

const options = [
"error",
"happy",
"warning",
"pop"
]; 

// Fade out audio function
function fadeOutAudio(audioElement, duration = 10000) {
if (!audioElement) return;
  
const startVolume = audioElement.volume;
const fadeOutDuration = duration; // 10 seconds
const fadeOutStartTime = Date.now();
  
if (fadeOutInterval) {
clearInterval(fadeOutInterval);
}
  
fadeOutInterval = setInterval(() => {
const elapsed = Date.now() - fadeOutStartTime;
const progress = Math.min(elapsed / fadeOutDuration, 1);
    
// Reduce volume from current level to 0
audioElement.volume = startVolume * (1 - progress);
    
// When fade out is complete
if (progress >= 1) {
clearInterval(fadeOutInterval);
audioElement.pause();
audioElement.currentTime = 0;
audioElement.volume = startVolume; // Reset volume for next time
}
}, 100); // Update every 100ms
}

// Stop all option sounds
function stopAllOptionSounds() {
if (fadeOutInterval) {
clearInterval(fadeOutInterval);
fadeOutInterval = null;
}
  
Object.values(soundElements).forEach(sound => {
if (sound) {
sound.pause();
sound.currentTime = 0;
}
});
  

if (stopSound) {
stopSound.pause();
stopSound.currentTime = 0;
}
}

function playOptionSound(option) {
// Stop any currently playing sounds
stopAllOptionSounds();
  
const sound = soundElements[option];
if (sound) {
// Reset sound to beginning
sound.currentTime = 0;
sound.volume = 1; // Start at full volume
    
// Play the sound
sound.play().then(() => {
// Start fade out after sound starts playing
setTimeout(() => {
fadeOutAudio(sound, 10000); // 10 second fade out
}, 1000); // Wait 1 second before starting fade out
}).catch(e => {
console.log("Could not play sound for", option, e);
// Fallback to stop sound if option sound fails
stopSound.currentTime = 0;
stopSound.volume = 1;
stopSound.play();
setTimeout(() => {
fadeOutAudio(stopSound, 10000);
}, 1000);
});
} else {
// Fallback to stop sound if no specific sound found
stopSound.currentTime = 0;
stopSound.volume = 1;
stopSound.play();
setTimeout(() => {
fadeOutAudio(stopSound, 10000);
}, 1000);
}


}


function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 max-w-md p-4 rounded-lg shadow-lg z-50 animate-slide-up ${
        type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
        type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
        'bg-blue-100 text-blue-800 border border-blue-200'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    if (type === 'success') {
        playOptionSound(options[1])
    }else{
        playOptionSound(options[0])

    }
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}