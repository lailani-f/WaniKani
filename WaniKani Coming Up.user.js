// ==UserScript==
// @name         WaniKani Coming Up
// @namespace    wk_lai
// @version      1.0
// @description  Shows upcoming progression reviews concisely
// @require      http://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @author       lai
// @match        *://www.wanikani.com/*
// @grant        GM_addStyle
// ==/UserScript==

(($) => {
  const valuesKey = "values";
  const latestKey = "latest";
  const availableAtKey = "availableAt";
  const unlockedAtKey = "unlockedAt";
  const srsStageKey = "srsStage";
  const amountKey = "amount";
  const srsScoreKey = "srsScore";
  const tagsKey = "tags";

  const indicatorWidth = 16;
  const halfIndicatorWidth = indicatorWidth / 2;

  const srsScores = [0, 14400000, 43200000, 126000000, 295200000, 896400000, 2102400000, 4690800000, 15055200000];

  const groupBy = function (xs, key) {
    const getOrSetEmpty = (map, key) => {
      const result = map.get(key);
      if (result) return result;
      const newValue = [];
      map.set(key, newValue);
      return newValue
    };
    return xs.reduce((map, x) => {
      const group = getOrSetEmpty(map, x[key]);
      group.push(x);
      return map;
    }, new Map());
  };

  // won't work with sparse arrays
  const first = (arr) => arr[0];
  const last = (arr) => arr.slice(-1).pop();

  const orderBy = (arr, predicate) => arr.slice().sort(predicate);

  const msToHours = (ms) => ms / 1000 / 60 / 60;
  const hoursToMs = (h) => h * 1000 * 60 * 60;


  GM_addStyle(
    '.cu-value { font-size: 20px; height: 1.5em; width: 1.5em; line-height: 1.5em; }' +
    '.cu-group-root { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, auto)); grid-gap: 15px 20px; }' +
    '.cu-grid { display: grid; grid-column-gap: 4px; grid-template-columns: repeat(auto-fill, 30px); height: 30px; justify-content: space-between; overflow: hidden; position: relative; }' +
    '.cu-root { font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif; }' +
    '.cu-group-head { position: relative; display: flex; display: flex; padding-top: 2px;background: linear-gradient(180deg,  #999 calc(0px), #fff calc(1px), transparent calc(100%)); margin-bottom: 5px; }' +
    '.cu-group-number { padding: 2px; width: 18px; text-align: center; background-color: #7000a9; }' +
    '.cu-group-head .cu-group-number { border-radius: 0; }' +
    '.cu-group-time { font-size: 11.844px; color: rgba(0,0,0,0.6); padding: 2px 3px 0; line-height: 14px; }' +
    `.cu-timeline { height: 16px; margin: 0 ${halfIndicatorWidth}px 13px; }` +
    `.cu-time-axis { position: absolute; left: 0; right: 0; top: 0; height: 3px; border-top: 1px solid white; border-bottom: 1px solid white; margin: 0 -${halfIndicatorWidth}px; }` +
    `.cu-indicator { position: absolute; top: 2px; padding: 0; width: ${indicatorWidth}px; padding: 1px 0; font-weight: normal; transition: left .5s ease-out; }` +
    '.cu-tag { background-color: #fff; color: rgba(0,0,0,0.6); text-shadow: none; font-weight: normal; }' +
    '.cu-spacer { flex-grow: 1; }' +
    '.cu-scale { position: absolute; top: 2px; height: 6px; border-left: 1px solid #d8d8d8; border-right: 1px solid white; }' +
    '.cu-scale-end { position: absolute; left: 100%; top: 2px; height: 6px; width: 8px; background: linear-gradient(135deg, #d8d8d8 50%, transparent calc(50% + 1px)); }' +
    '.cu-scale-head { position: absolute; right: 0; bottom: 100%; font-size: 11.844px; line-height: 1em; color: #777; font-weight: 300; text-shadow: 0 1px 0 #fff;}' +
    '.cu-overflow-icon { position: absolute; top:0; left: 0; padding: 0; font-size: 14px; height: 100%; width: 100%; line-height: 2em; background: linear-gradient(-45deg, #5571e2, #294ddb); }'
  );


  class CuDataService {
    process(progressionData) {
      const unlockedData = progressionData.filter(v => v[unlockedAtKey]);
      const groupedData = Array.from(groupBy(unlockedData, availableAtKey));
      const filteredData = groupedData.filter(x => x[0] != null).filter(x => x[1].length);
      const enhancedGroups = filteredData.map(d => this.createEnhancedGroup(d));
      return this.createEnhancedTotal(enhancedGroups);
    }

    findLowestSrsStage(values) {
      const lowOrdered = orderBy(values, (a, b) => a[srsStageKey] - b[srsStageKey]);
      const lowestValue = first(lowOrdered);
      return lowestValue[srsStageKey];
    }

    sortByLowestLevel(groups) {
      return orderBy(groups, (a, b) => a[srsScoreKey] - b[srsScoreKey]);
    }

    sortByLargestAmount(groups) {
      return orderBy(groups, (a, b) => b[amountKey] - a[amountKey]);
    }

    sortByFirstAvailable(groups) {
      return orderBy(groups, (a, b) => a[availableAtKey] - b[availableAtKey]);
    }

    calculateSrsScore(availableAt, values) {
      const lowestSrsStage = this.findLowestSrsStage(values);
      return availableAt + srsScores[lowestSrsStage]
    }
    createEnhancedGroup(x) {
      const values = x[1];
      const availableAt = new Date(x[0]).getTime();
      const srsScore = this.calculateSrsScore(availableAt, values);
      return {
        [valuesKey]: values,
        [availableAtKey]: availableAt,
        [amountKey]: values.length,
        [srsScoreKey]: srsScore,
        [tagsKey]: []
      };
    };

    createEnhancedTotal(groups) {
      const lowestGroup = first(this.sortByLowestLevel(groups));
      const largestGroup = first(this.sortByLargestAmount(groups));
      const groupsSortedByEarliest = this.sortByFirstAvailable(groups);
      const earliestGroup = first(groupsSortedByEarliest);
      const latestGroup = last(groupsSortedByEarliest);

      // const groupLayout = [earliestGroup, lowestGroup, largestGroup, ...groupsSortedByEarliest];
      // const distinctGroups = [... new Set(groupLayout)];

      return {
        [latestKey]: latestGroup,
        [availableAtKey]: earliestGroup,
        [amountKey]: largestGroup,
        [srsScoreKey]: lowestGroup,
        [valuesKey]: groupsSortedByEarliest
      };
    }

  }

  class CuDomScaffoldingService {
    constructor(enhancedData, maxGroups) {
      this.enhancedData = enhancedData;
      this.maxGroups = maxGroups || 3;
      this.timelineScalings = [6, 12, 24, 48, 72, 96];
      this.timelineScalingFallback = 24;
    }

    buildComponent() {
      this.now = new Date().getTime();

      const $head = $("<h2 class='text-xl text-medium text-dark-gray text-left mb-0'>Coming Up</h2>");
      const $timeline = this.createTimeline();
      const $groupContainer = this.createGroupContainer();

      return $("<div class='cu-root' />")
        .append($head)
        .append($timeline)
        .append($groupContainer);
    }

    createGroupContainer() {
      const groups = this.createGroups();

      return $("<div class='cu-group-root' />")
        .append(groups);
    }

    createGroups() {
      return this.enhancedData[valuesKey]
        .slice(0, this.maxGroups)
        .map((g, i) => this.createGroup(g, i));
    }

    getClassName(type) {
      switch (type) {
        case "Kanji":
          return "kanji-icon";
        case "Radical":
          return "radical-icon";
      }
    };

    createTag(name, title) {
      return $("<div class='cu-tag badge' />")
        .text(name)
        .attr("title", title);
    }

    createTags(group) {
      const tags = [];
      if (group === this.enhancedData[amountKey]) {
        tags.push(this.createTag("largest", "This group contains the largest amount of review material."));
      }
      if (group[availableAtKey] <= this.now) {
        tags.push(this.createTag("available", "Shoo, now. Don't leave the Crabigator waiting."));
      } else if (group === this.enhancedData[availableAtKey]) {
        tags.push(this.createTag("earliest", "This group will be the earliest available for review."));
      }
      if (group === this.enhancedData[srsScoreKey]) {
        tags.push(this.createTag("critical", "In this group are one or more items of the lowest SRS stage."));
      }
      return tags;
    };


    createTimeToGo(group) {
      return $("<div class='cu-group-time' />")
        .data(availableAtKey, group[availableAtKey])
    };

    createGridItemContent(value) {
      if (value.characterImage) {
        return $("<img  src=''/>")
          .attr("src", value.characterImage);
      } else {
        return $(document.createTextNode(value.characters));
      }
    }

    createGridValue(value) {
      const className = this.getClassName(value.type);
      const $itemContent = this.createGridItemContent(value);

      return $("<div class='cu-value' />")
        .addClass(className)
        .append($itemContent);
    };

    createBody(group) {
      const gridValues = group[valuesKey].map(v => this.createGridValue(v));

      return $("<div class='cu-grid' />")
        .append(gridValues);
    };

    createGroupHead(group, index) {
      const tags = this.createTags(group);
      const $number = $("<div class='cu-group-number badge' />")
        .text(index + 1);
      const $spacer = $("<div class='cu-spacer' />");
      const $timeToGo = this.createTimeToGo(group);

      return $("<div class='cu-group-head' />")
        .append($number)
        .append(tags)
        .append($spacer)
        .append($timeToGo);
    }

    createGroup(group, index) {
      const $head = this.createGroupHead(group, index);
      const $body = this.createBody(group);

      return $("<div class='cu-group' />")
        .append($head)
        .append($body);
    };


    createIndicator(group, index) {
      return $("<div class='cu-indicator cu-group-number badge' />")
        .text(index + 1)
        .data(availableAtKey, group[availableAtKey]);
    };

    createScale(index) {
      const left = index / this.timelineScale * 100;
      return $("<div class='cu-scale' />").css({'left': `${left}%`});
    }

    calculateAvailableIn(availableAt) {
      return availableAt - this.now;
    }


    calculateScale() {
      // smallest fitting scale
      const latestHour = msToHours(this.calculateAvailableIn(this.enhancedData[latestKey][availableAtKey]));
      return this.timelineScalings.find(x => x > latestHour) || this.timelineScalingFallback;
    }
    createTimeline() {
      this.timelineScale = this.calculateScale();

      const $timeAxis = $("<div class='cu-time-axis boxshadow-inset bg-mid-gray' />");
      const $scaleEnd = $("<div class='cu-scale-end' />");
      const $head = $("<div class='cu-scale-head' />")
        .text(`${this.timelineScale} hours`);

      const indicators = this.enhancedData[valuesKey].map(this.createIndicator);
      const scales = Array(this.timelineScale).fill().map((_, i) => this.createScale(i));

      return $("<div class='cu-timeline relative' />")
        .append($head)
        .append($timeAxis)
        .append(scales)
        .append($scaleEnd)
        .append(indicators);
    };
  }


  class CuObserver {
    constructor($root) {
      this.$root = $root;
      this.$groups = this.$root.find(".cu-group");
      this.$timelineIndicators = this.$root.find(".cu-indicator");
      this.$groupTimes = this.$root.find(".cu-group-time");

      // caveman mode
      this.initInternal = this.initInternal.bind(this);
      this.intervalUpdate = this.intervalUpdate.bind(this);
      this.resizeUpdate = this.resizeUpdate.bind(this);
    }

    init(timelineSpanHours) {
      this.timelineSpanMs = hoursToMs(timelineSpanHours || 24);

      this.uninit();
      this.timeoutId = setTimeout(this.initInternal, 10); // 10ms
      this.intervalId = setInterval(this.intervalUpdate, 1000 * 60); // 60s
      window.addEventListener("resize", this.resizeUpdate);
    }

    uninit() {
      clearTimeout(this.timeoutId);
      clearInterval(this.intervalId);
      window.removeEventListener("resize", this.resizeUpdate);
    }

    initInternal() {
      this.intervalUpdate();
      this.setOverflowIndicator();
    }

    resizeUpdate() {
      this.removeOverflowIndicator();
      this.setOverflowIndicator();
    }

    intervalUpdate() {
      this.now = new Date().getTime();
      this.updateGroupTimes();
      this.updateTimelineIndicator();
    }

    removeOverflowIndicator() {
      this.$groups.find(".cu-overflow-icon").remove();
    }

    createTimeLiteral(dcMinutesToGo) {
      if (dcMinutesToGo <= 0) {
        return '';
      }
      if (dcMinutesToGo <= 60) {
        const minutesToGo = Math.ceil(dcMinutesToGo);
        const suffix = minutesToGo === 1 ? 'minute' : 'minutes';
        return `in ${minutesToGo} ${suffix}`;
      }
      const hoursToGo = Math.ceil(dcMinutesToGo / 60);
      return `in ${hoursToGo} hours`;
    }

    updateGroupTimes() {
      this.$groupTimes.each((i, e) => {
        const $groupTime = $(e);
        const availableAt = $groupTime.data(availableAtKey);
        const dcMinutesToGo = (availableAt - this.now) / 1000 / 60;
        const text = this.createTimeLiteral(dcMinutesToGo);
        $groupTime.text(text);
      });
    }

    getIndicatorCss(relative) {
      if (relative < 0) {
        return {
          'left': `-${halfIndicatorWidth}px`
        };
      }
      if (relative > 100) {
        return {
          'visibility': 'hidden'
        }
      }
      return {
        'left': `calc(${relative}% - ${halfIndicatorWidth}px)`
      }
    }

    updateTimelineIndicator() {
      this.$timelineIndicators.each((i, e) => {
        const $indicator = $(e);
        const availableAt = $indicator.data(availableAtKey);
        const relative = (availableAt - this.now) / this.timelineSpanMs * 100;
        $indicator.css(this.getIndicatorCss(relative));
      });
    }

    setOverflowIndicator() {
      this.$groups.each((i, e) => {
        const $group = $(e);
        const $grid = $group.find(".cu-grid");
        const $values = $group.find(".cu-value");
        const bounds = {x: $grid.width(), y: $grid.height()};

        const $visibles = $values.filter((i, v) => {
          const position = $(v).position();
          return position.left < bounds.x && position.top < bounds.y;
        });
        if ($visibles.length === $values.length) return;

        const lastVisible = $visibles.slice(-1).get(0);
        const numInvisible = $values.length - $visibles.length + 1; // +1 because the last visible element now gets obscured.

        const $overflowIndicator = $("<div class='cu-overflow-icon' />")
          .text(`+${numInvisible}`);

        $(lastVisible).append($overflowIndicator);
      });
    };
  }

  // set up
  const $progression = $(".progression");
  if (!$progression.length) return;

  const progressionData = $progression.children("div").data("react-props").data;
  const enhancedData = new CuDataService().process(progressionData);

  const scaffoldingService = new CuDomScaffoldingService(enhancedData, 4);
  const $root = scaffoldingService.buildComponent();

  const $mountPoint = $progression.find("div[title]").first();
  $root.insertAfter($mountPoint);

  const cuObserver = new CuObserver($root);
  cuObserver.init(scaffoldingService.timelineScale);
})(window.$);