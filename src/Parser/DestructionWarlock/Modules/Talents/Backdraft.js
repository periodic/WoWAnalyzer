import React from 'react';
import Module from 'Parser/Core/Module';
import Combatants from 'Parser/Core/Modules/Combatants';

import SPELLS from 'common/SPELLS';
import StatisticBox, { STATISTIC_ORDER }  from 'Main/StatisticBox';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';

const debug = false;

const STACKS_PER_APPLICATION = 2;
const MAX_STACKS = 4;
const BUFF_DURATION = 10000;

//haven't yet found out if it's exactly 10 second delay between application and removal of the buff (or is it few ms earlier), might need to tweak with that to be accurate
const REMOVEBUFF_TOLERANCE = 20;

class Backdraft extends Module {
  static dependencies = {
    combatants: Combatants,
  };

  _currentStacks = 0;
  _expectedBuffEnd = 0;
  wastedStacks = 0;

  on_initialized() {
    if (!this.owner.error) {
      this.active = this.combatants.selected.hasTalent(SPELLS.BACKDRAFT_TALENT.id);
    }
  }

  on_byPlayer_cast(event) {
    if (event.ability.guid !== SPELLS.CONFLAGRATE.id) {
      return;
    }
    this._currentStacks += STACKS_PER_APPLICATION;
    if (this._currentStacks > MAX_STACKS) {
      debug && console.log("backdraft stack waste at ", event.timestamp);
      this.wastedStacks += this._currentStacks - MAX_STACKS;
      this._currentStacks = MAX_STACKS;
    }
    this._expectedBuffEnd = event.timestamp + BUFF_DURATION;
  }

  on_toPlayer_removebuffstack(event) {
    if (event.ability.guid !== SPELLS.BACKDRAFT.id) {
      return;
    }
    this._currentStacks--;
  }

  on_toPlayer_removebuff(event) {
    if (event.ability.guid !== SPELLS.BACKDRAFT.id) {
      return;
    }
    if (event.timestamp >= this._expectedBuffEnd - REMOVEBUFF_TOLERANCE) {
      //if the buff expired when it "should", we wasted some stacks
      debug && console.log("backdraft stack waste at ", event.timestamp);
      this.wastedStacks += this._currentStacks;
    }
    this._currentStacks = 0;
  }

  suggestions(when) {
    const wastedStacksPerMinute = this.wastedStacks / this.owner.fightDuration * 1000 * 60;
    when(wastedStacksPerMinute).isGreaterThan(1)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(<span>You should use your <SpellLink id={SPELLS.BACKDRAFT_TALENT.id}/> stacks more. You have wasted {this.wastedStacks} stacks this fight.</span>)
          .icon(SPELLS.BACKDRAFT_TALENT.icon)
          .actual(`${wastedStacksPerMinute.toFixed(2)} wasted Backdraft stacks per minute`)
          .recommended(`< ${recommended} is recommended`)
          .regular(recommended + 0.5).major(recommended + 1);
      });
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.BACKDRAFT_TALENT.id} />}
        value={this.wastedStacks}
        label='Wasted Backdraft stacks'
      />
    );
  }

  statisticOrder = STATISTIC_ORDER.OPTIONAL(1);
}

export default Backdraft;
