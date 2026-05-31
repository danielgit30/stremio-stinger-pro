const getResultObj = (mid, post, no, url, source, bloopers = false, definitive = false, sequel = false) => {
    return { mid, post, no, url, source, bloopers, definitive, sequel };
};

const formatMessage = (styleConfig, data) => {
    let output = [];
    const isSimple = styleConfig.style === 'simple';
    const showBloopers = styleConfig.showBloopers;

    if (data.source === 'Wikipedia' && !data.mid && !data.post && !data.bloopers) {
        return isSimple ? 'Unclassified Scene' : '❓ Unclassified Scene';
    }

    if (isSimple) {
        if (data.mid && data.post) output.push('Mid-Credits Scene\nPost-Credits Scene');
        else if (data.mid) output.push('Mid-Credits Scene');
        else if (data.post) output.push('Post-Credits Scene');
        else if (!data.bloopers || !showBloopers) {
            output.push(data.no || (data.bloopers && !showBloopers) ? 'No Bonus Scenes' : 'No Stingers Found');
        }
    } else {
        if (data.mid && data.post) output.push('🍿 Mid & Post-Credits Scenes');
        else if (data.mid) output.push('⏳ Mid-Credits Scene');
        else if (data.post) output.push('🎬 Post-Credits Scene');
        else if (!data.bloopers || !showBloopers) {
            output.push(
                data.no || (data.bloopers && !showBloopers) ? '🏃‍♂️ Nothing But Credits' : "🕵️‍♂️ Couldn't Find Stingers"
            );
        }
    }

    if (showBloopers && data.bloopers) {
        output.push(isSimple ? 'Outtakes' : '🎭 Outtakes');
    }

    if (styleConfig.showSequel && data.sequel && data.source === 'AfterCredits') {
        output.push(isSimple ? 'Sequel Setup' : '🔮 Sets Up For A Sequel');
    }

    return output.join('\n');
};

module.exports = {
    getResultObj,
    formatMessage,
};
