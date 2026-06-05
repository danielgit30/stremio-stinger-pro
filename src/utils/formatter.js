const getResultObj = (
    mid,
    post,
    no,
    url,
    source,
    bloopers = false,
    definitive = false,
    sequel = false,
    audioOnly = false
) => {
    return { mid, post, no, url, source, bloopers, definitive, sequel, audioOnly };
};

const formatMessage = (styleConfig, data) => {
    let output = [];
    const isSimple = styleConfig.style === 'simple';
    const isMonochrome = styleConfig.style === 'monochrome';
    const showBloopers = styleConfig.showBloopers;

    if (data.source === 'Wikipedia' && !data.mid && !data.post && !data.bloopers) {
        if (isSimple) return 'Unclassified';
        if (isMonochrome) return '⚠ Unclassified Scene';
        return '❓ Unclassified Scene';
    }

    if (isSimple) {
        if (data.mid && data.post) output.push(data.audioOnly ? 'Mid & Post (Audio)' : 'Mid & Post');
        else if (data.mid) output.push(data.audioOnly ? 'Mid Audio' : 'Mid Only');
        else if (data.post) output.push(data.audioOnly ? 'Post Audio' : 'Post Only');
        else if (!data.bloopers || !showBloopers) {
            output.push(data.no || (data.bloopers && !showBloopers) ? 'None' : 'No Stingers');
        }
    } else if (isMonochrome) {
        if (data.mid && data.post)
            output.push(data.audioOnly ? '⤹⤷ Mid & Post-Credits Scenes (Audio Only)' : '⤹⤷ Mid & Post-Credits Scenes');
        else if (data.mid) output.push(data.audioOnly ? '🕪 Mid-Credits Audio Cue' : '⤷ Mid-Credits Scene');
        else if (data.post) output.push(data.audioOnly ? '🕪 Post-Credits Audio Cue' : '⤵︎ Post-Credits Scene');
        else if (!data.bloopers || !showBloopers) {
            output.push(
                data.no || (data.bloopers && !showBloopers) ? '𐦂 Nothing But Credits' : "⊘ Couldn't Find Stingers"
            );
        }
    } else {
        if (data.mid && data.post)
            output.push(data.audioOnly ? '🍿 Mid & Post-Credits Scenes (Audio Only)' : '🍿 Mid & Post-Credits Scenes');
        else if (data.mid) output.push(data.audioOnly ? '🔊 Mid-Credits Audio Cue' : '⏳ Mid-Credits Scene');
        else if (data.post) output.push(data.audioOnly ? '🔊 Post-Credits Audio Cue' : '🎬 Post-Credits Scene');
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
        else if (isMonochrome) output.push('⛶ Sets Up For A Sequel');
        else output.push('🔮 Sets Up For A Sequel');
    }

    return output.join('\n');
};

const formatRelatedMessage = (styleConfig, data) => {
    let output = [];
    const isSimple = styleConfig.style === 'simple';
    const isMonochrome = styleConfig.style === 'monochrome';

    const prequelStr = data.prequel
        ? `${data.prequel.title} (${data.prequel.release_date ? data.prequel.release_date.split('-')[0] : 'N/A'})`
        : '';
    const sequelStr = data.sequel
        ? `${data.sequel.title} (${data.sequel.release_date ? data.sequel.release_date.split('-')[0] : 'N/A'})`
        : '';

    if (isSimple) {
        if (data.sourceMaterial) output.push(`Based on ${data.sourceMaterial}`);
        if (prequelStr) output.push(`Prequel: ${prequelStr}`);
        if (sequelStr) output.push(`Sequel: ${sequelStr}`);
    } else if (isMonochrome) {
        if (data.sourceMaterial) output.push(`✐ Based on ${data.sourceMaterial}`);
        if (prequelStr) output.push(`◂ ${prequelStr}`);
        if (sequelStr) output.push(`▸ ${sequelStr}`);
    } else {
        if (data.sourceMaterial) output.push(`📖 Based on ${data.sourceMaterial}`);
        if (prequelStr) output.push(`⏪ ${prequelStr}`);
        if (sequelStr) output.push(`⏩ ${sequelStr}`);
    }

    return output.join('\n');
};

module.exports = {
    getResultObj,
    formatMessage,
    formatRelatedMessage,
};
