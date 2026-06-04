const getResultObj = (mid, post, no, url, source, bloopers = false, definitive = false, sequel = false) => {
    return { mid, post, no, url, source, bloopers, definitive, sequel };
};

const formatMessage = (styleConfig, data) => {
    let output = [];
    const isSimple = styleConfig.style === 'simple';
    const isMonochrome = styleConfig.style === 'monochrome';
    const showBloopers = styleConfig.showBloopers;

    if (data.source === 'Wikipedia' && !data.mid && !data.post && !data.bloopers) {
        if (isSimple) return 'Unclassified Scene';
        if (isMonochrome) return '⚠ Unclassified Scene';
        return '❓ Unclassified Scene';
    }

    if (isSimple) {
        if (data.mid && data.post) output.push('Mid-Credits Scene\nPost-Credits Scene');
        else if (data.mid) output.push('Mid-Credits Scene');
        else if (data.post) output.push('Post-Credits Scene');
        else if (!data.bloopers || !showBloopers) {
            output.push(data.no || (data.bloopers && !showBloopers) ? 'No Bonus Scenes' : 'No Stingers Found');
        }
    } else if (isMonochrome) {
        if (data.mid && data.post) output.push('⤷ Mid-Credits Scene\n⤵︎ Post-Credits Scene');
        else if (data.mid) output.push('⤷ Mid-Credits Scene');
        else if (data.post) output.push('⤵︎ Post-Credits Scene');
        else if (!data.bloopers || !showBloopers) {
            output.push(
                data.no || (data.bloopers && !showBloopers) ? '⍈ Nothing But Credits' : "✖ Couldn't Find Stingers"
            );
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
        if (isSimple) output.push('Outtakes');
        else if (isMonochrome) output.push('☄ Outtakes');
        else output.push('🎭 Outtakes');
    }

    if (styleConfig.showSequel && data.sequel && data.source === 'AfterCredits') {
        if (isSimple) output.push('Sequel Setup');
        else if (isMonochrome) output.push('📽 Sets Up For A Sequel');
        else output.push('🔮 Sets Up For A Sequel');
    }

    return output.join('\n');
};

module.exports = {
    getResultObj,
    formatMessage,
};
