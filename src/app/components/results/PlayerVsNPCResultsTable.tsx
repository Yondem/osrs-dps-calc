import React, { PropsWithChildren, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/state';
import { PlayerVsNPCCalculatedLoadout } from '@/types/State';
import Spinner from '@/app/components/Spinner';
import { ACCURACY_PRECISION, DPS_PRECISION, EXPECTED_HIT_PRECISION } from '@/lib/constants';
import { max, min, some } from 'd3-array';
import { toJS } from 'mobx';
import { isDefined } from '@/utils';
import UserIssueType from '@/enums/UserIssueType';

interface IResultRowProps {
  calcKey: keyof Omit<PlayerVsNPCCalculatedLoadout, 'ttkDist'>;
  hasResults: boolean;
  collapseSpecs?: boolean;
  title?: string;
}

const calcKeyToString = (value: number, calcKey: keyof PlayerVsNPCCalculatedLoadout): string | React.ReactNode => {
  if (value === undefined || value === null) {
    return (<p className="text-sm">---</p>);
  }

  switch (calcKey) {
    case 'accuracy':
    case 'specAccuracy':
      return `${(value * 100).toFixed(ACCURACY_PRECISION)}%`;
    case 'dps':
    case 'totalDps':
    case 'rotationDps':
    case 'specMomentDps':
      return value.toFixed(DPS_PRECISION);
    case 'specFullDps':
      return value.toPrecision(DPS_PRECISION);
    case 'expectedHit':
    case 'specExpected':
      return value.toFixed(EXPECTED_HIT_PRECISION);
    case 'specPerEnergy':
      return value.toFixed(DPS_PRECISION);
    case 'ttk':
    case 'rotationTtk':
      return value === 0
        ? '-----'
        : `${value.toFixed(1)}s`;
    default:
      return `${value}`;
  }
};

const ResultRowHeader: React.FC<PropsWithChildren> = (props) => {
  const { children } = props;

  return (
    <tr>
      <th
        className="t-group-header"
        colSpan={999}
      >
        {children}
      </th>
    </tr>
  );
};

const ResultRow: React.FC<PropsWithChildren<IResultRowProps>> = observer((props) => {
  const store = useStore();
  const {
    children,
    calcKey,
    title,
    hasResults,
    collapseSpecs,
  } = props;
  const { calc, userIssues } = store;
  const loadouts = toJS(calc.loadouts);

  const cells = useMemo(() => {
    const isTtk = calcKey === 'ttk' || calcKey === 'rotationTtk';
    const aggregator = (isTtk || calcKey === 'npcDefRoll') ? min : max;
    const bestValue = aggregator(Object.values(loadouts).filter((l) => (isTtk ? l[calcKey] !== 0 : true)), (l) => l[calcKey] as number);

    return Object.values(loadouts).map((l, i) => {
      const value = l[calcKey] as number;
      if (hasResults && calcKey.startsWith('spec') && (l.specExpected === undefined || l.specExpected === null)) {
        // results are in, but the weapon has no implemented special attack
        // we colspan on the first entry (specAccuracy) if extended, and just return nothing for the rest
        return (calcKey === 'specAccuracy' || !collapseSpecs)
          ? (
            // eslint-disable-next-line react/no-array-index-key
            <th key={i} rowSpan={6} className="w-28 border-r bg-dark-400 text-dark-200 text-center text-xs">
              {userIssues.find((is) => is.loadout === `${i + 1}` && is.type === UserIssueType.EQUIPMENT_SPEC_UNSUPPORTED) ? 'Not implemented' : 'N/A'}
            </th>
          ) : undefined;
      }

      return (
        // eslint-disable-next-line react/no-array-index-key
        <th className={`text-center w-28 border-r ${((Object.values(loadouts).length > 1) && bestValue === value) ? 'dark:text-green-200 text-green-800' : 'dark:text-body-200 text-black'}`} key={i}>
          {hasResults ? calcKeyToString(value, calcKey) : (<Spinner className="w-3" />)}
        </th>
      );
    });
  }, [loadouts, calcKey, collapseSpecs, hasResults, userIssues]);

  return (
    <tr>
      <th className="w-40 px-4 border-r bg-btns-400 dark:bg-dark-500 select-none cursor-help underline decoration-dotted decoration-gray-300" title={title}>{children}</th>
      {cells}
    </tr>
  );
});

const PlayerVsNPCResultsTable: React.FC = observer(() => {
  const store = useStore();
  const { selectedLoadout, calc } = store;
  const { resultsExpanded } = store.prefs;

  const loadouts = toJS(calc.loadouts);
  const hasResults = useMemo(() => some(loadouts, (l) => some(Object.entries(l), ([, v]) => isDefined(v))), [loadouts]);

  return (
    <table>
      <thead>
        <tr>
          <th aria-label="blank" className="bg-btns-400 border-r dark:bg-dark-500 select-none" />
          {store.loadouts.map(({ name }, i) => (
            <th
              role="button"
              tabIndex={0}
            // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={`text-center w-28 border-r py-1.5 font-bold font-serif leading-tight text-xs cursor-pointer transition-colors ${selectedLoadout === i ? 'bg-orange-400 dark:bg-orange-700' : 'bg-btns-400 dark:bg-dark-500'}`}
              onClick={() => store.setSelectedLoadout(i)}
            >
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <ResultRow calcKey="maxHit" title="The maximum hit that you will deal to the monster" hasResults={hasResults}>
          Max hit
        </ResultRow>
        {resultsExpanded && (
          <ResultRow calcKey="expectedHit" title="The average damage per attack, including misses." hasResults={hasResults}>
            Expected hit
          </ResultRow>
        )}
        <ResultRow calcKey="dps" title="The average damage you will deal per-second" hasResults={hasResults}>
          DPS
        </ResultRow>
        {some(loadouts, (l) => isDefined(l.totalDps)) && (
          <ResultRow calcKey="totalDps" title="Your damage per second to every monster your Venator bow hits" hasResults={hasResults}>
            Total DPS
          </ResultRow>
        )}
        <ResultRow calcKey="ttk" title="The average time (in seconds) it will take to defeat the monster" hasResults={hasResults}>
          Avg. TTK
        </ResultRow>
        {some(loadouts, (l) => isDefined(l.rotationTtk)) && (
          <>
            <ResultRow calcKey="rotationDps" title="Your DPS when you also spec with your spec weapon whenever you have the energy" hasResults={hasResults}>
              DPS with specs
            </ResultRow>
            <ResultRow calcKey="rotationTtk" title="Your average kill time when you also spec with your spec weapon whenever you have the energy" hasResults={hasResults}>
              Avg. TTK with specs
            </ResultRow>
          </>
        )}
        <ResultRow calcKey="accuracy" title="How accurate you are against the monster" hasResults={hasResults}>
          Accuracy
        </ResultRow>
        {!resultsExpanded && (
          <ResultRow calcKey="specExpected" title="The expected hit that the special attack will deal to the monster per use, including misses" hasResults={hasResults} collapseSpecs={resultsExpanded}>
            Spec expected hit
          </ResultRow>
        )}
        {resultsExpanded && (
          <>
            <ResultRowHeader>
              Rolls
            </ResultRowHeader>
            <ResultRow calcKey="maxAttackRoll" title="The maximum attack roll based on your current gear (higher is better!)" hasResults={hasResults}>
              Attack roll
            </ResultRow>
            <ResultRow calcKey="npcDefRoll" title="The NPC's defense roll (lower is better!)" hasResults={hasResults}>
              NPC def roll
            </ResultRow>
            <ResultRowHeader>
              Special attack
            </ResultRowHeader>
            <ResultRow calcKey="specAccuracy" title="How accurate your special attack is against the monster" hasResults={hasResults} collapseSpecs={resultsExpanded}>
              Accuracy
            </ResultRow>
            <ResultRow calcKey="specMomentDps" title="The average damage you would deal per-second, given infinite special attack energy" hasResults={hasResults} collapseSpecs={resultsExpanded}>
              DPS
            </ResultRow>
            <ResultRow calcKey="specFullDps" title="The damage per-second of the special attack, accounting for special attack regeneration" hasResults={hasResults} collapseSpecs={resultsExpanded}>
              Spec-only DPS
            </ResultRow>
            <ResultRow calcKey="specMaxHit" title="The maximum hit that the special attack can deal to the monster" hasResults={hasResults} collapseSpecs={resultsExpanded}>
              Max hit
            </ResultRow>
            <ResultRow calcKey="specExpected" title="The expected hit that the special attack will deal to the monster per use, including misses" hasResults={hasResults} collapseSpecs={resultsExpanded}>
              Expected hit
            </ResultRow>
            <ResultRow calcKey="specPerEnergy" title="The expected hit for each 1% of special attack energy the spec costs" hasResults={hasResults} collapseSpecs={resultsExpanded}>
              Damage per 1% spec
            </ResultRow>
          </>
        )}
      </tbody>
    </table>
  );
});

export default PlayerVsNPCResultsTable;
